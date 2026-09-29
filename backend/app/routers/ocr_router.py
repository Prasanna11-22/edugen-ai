import os
import json
import secrets
import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Source, SourceVersion, SourcePage, Chunk
from ..schemas import (
    OCRPageResponse, SourcePageReviewRequest, BatchOCRResponse, OCRSummaryResponse
)
from ..auth import teacher_required
from ..services.ocr_service import (
    process_page_ocr, parse_ocr_transcription, process_pages_batch_concurrent,
    DEFAULT_CONFIDENCE_THRESHOLD
)

router = APIRouter(prefix="/api/ocr", tags=["OCR & Document Ingestion"])

def _format_source_page_response(page: SourcePage) -> Dict[str, Any]:
    uncertain_spans = []
    if page.uncertain_spans_json:
        try:
            uncertain_spans = json.loads(page.uncertain_spans_json)
        except Exception:
            uncertain_spans = []

    return {
        "id": page.id,
        "page_number": page.page_number,
        "source_id": page.source_id,
        "source_version_id": page.source_version_id,
        "image_path": page.image_path,
        "ocr_raw_text": page.ocr_raw_text or "",
        "reviewed_text": page.reviewed_text or page.ocr_raw_text or "",
        "confidence_score": page.confidence_score if page.confidence_score is not None else 1.0,
        "review_status": page.review_status or "auto_accepted", # auto_accepted, needs_review, reviewed
        "has_uncertain_spans": len(uncertain_spans) > 0,
        "uncertain_spans": uncertain_spans,
        "uncertain_count": len(uncertain_spans),
        "ocr_provider": page.ocr_provider or "gemini_vision",
        "reviewed_by": page.reviewed_by,
        "reviewed_at": page.reviewed_at,
        "teacher_notes": page.teacher_notes,
        "created_at": page.created_at
    }


@router.post("/process-page", response_model=OCRPageResponse)
async def process_single_page(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    page_number: int = Form(1),
    source_id: Optional[int] = Form(None),
    source_version_id: Optional[int] = Form(None),
    confidence_threshold: float = Form(DEFAULT_CONFIDENCE_THRESHOLD),
    provider: str = Form("gemini_vision"),
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """
    Processes OCR for a single page.
    Applies review-by-exception threshold:
    - >= threshold (85%): review_status = 'auto_accepted', reviewed_text = ocr_raw_text
    - < threshold: review_status = 'needs_review'
    """
    image_bytes = b""
    mime_type = "image/png"
    image_path = None

    if file:
        image_bytes = await file.read()
        mime_type = file.content_type or "image/png"
        os.makedirs("uploads/ocr_pages", exist_ok=True)
        image_path = f"uploads/ocr_pages/{secrets.token_hex(6)}_p{page_number}_{file.filename}"
        with open(image_path, "wb") as out_f:
            out_f.write(image_bytes)

    if image_bytes:
        ocr_result = process_page_ocr(
            image_bytes=image_bytes,
            mime_type=mime_type,
            page_number=page_number,
            confidence_threshold=confidence_threshold,
            provider=provider
        )
    elif raw_text:
        ocr_result = parse_ocr_transcription(raw_text, confidence_threshold=confidence_threshold)
        ocr_result["page_number"] = page_number
        ocr_result["ocr_provider"] = "direct_text"
    else:
        raise HTTPException(status_code=400, detail="Must provide either an image file or raw text.")

    if source_id or source_version_id:
        existing = db.query(SourcePage).filter(
            SourcePage.source_id == source_id,
            SourcePage.page_number == page_number
        ).first()

        if existing:
            page_record = existing
            page_record.ocr_raw_text = ocr_result["ocr_raw_text"]
            page_record.reviewed_text = ocr_result["reviewed_text"]
            page_record.confidence_score = ocr_result["confidence_score"]
            page_record.review_status = ocr_result["review_status"]
            page_record.uncertain_spans_json = json.dumps(ocr_result["uncertain_spans"])
            page_record.ocr_provider = ocr_result["ocr_provider"]
            if image_path:
                page_record.image_path = image_path
            page_record.updated_at = datetime.datetime.utcnow()
        else:
            page_record = SourcePage(
                source_id=source_id,
                source_version_id=source_version_id,
                teacher_id=current_teacher.id,
                page_number=page_number,
                image_path=image_path,
                ocr_raw_text=ocr_result["ocr_raw_text"],
                reviewed_text=ocr_result["reviewed_text"],
                confidence_score=ocr_result["confidence_score"],
                review_status=ocr_result["review_status"],
                uncertain_spans_json=json.dumps(ocr_result["uncertain_spans"]),
                ocr_provider=ocr_result["ocr_provider"],
                created_at=datetime.datetime.utcnow()
            )
            db.add(page_record)

        db.commit()
        db.refresh(page_record)
        return _format_source_page_response(page_record)

    return {
        "id": None,
        "page_number": page_number,
        "source_id": source_id,
        "source_version_id": source_version_id,
        "image_path": image_path,
        "ocr_raw_text": ocr_result["ocr_raw_text"],
        "reviewed_text": ocr_result["reviewed_text"],
        "confidence_score": ocr_result["confidence_score"],
        "review_status": ocr_result["review_status"],
        "has_uncertain_spans": ocr_result["has_uncertain_spans"],
        "uncertain_spans": ocr_result["uncertain_spans"],
        "uncertain_count": ocr_result["uncertain_count"],
        "ocr_provider": ocr_result["ocr_provider"],
        "reviewed_by": None,
        "reviewed_at": None,
        "teacher_notes": None,
        "created_at": datetime.datetime.utcnow()
    }


@router.post("/batch", response_model=BatchOCRResponse)
async def process_batch_ocr(
    files: List[UploadFile] = File(...),
    source_id: Optional[int] = Form(None),
    source_version_id: Optional[int] = Form(None),
    confidence_threshold: float = Form(DEFAULT_CONFIDENCE_THRESHOLD),
    provider: str = Form("gemini_vision"),
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """
    Batch processes multiple scanned document page images concurrently using ThreadPoolExecutor.
    - Pages with confidence >= threshold (85%): review_status = 'auto_accepted'
    - Pages with confidence < threshold: review_status = 'needs_review'
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided for batch OCR.")

    os.makedirs("uploads/ocr_pages", exist_ok=True)
    pages_input_data = []

    for f in files:
        file_bytes = await f.read()
        mime_type = f.content_type or "image/png"
        is_pdf = f.filename.lower().endswith(".pdf") or "pdf" in mime_type.lower()

        if is_pdf:
            try:
                import io
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(file_bytes))
                num_pdf_pages = len(reader.pages)

                for p_idx, pdf_page in enumerate(reader.pages):
                    page_num = len(pages_input_data) + 1
                    extracted = pdf_page.extract_text() or ""

                    # If page has native digital text, use it directly (super fast, 0 network delay)
                    if len(extracted.strip()) >= 30:
                        safe_path = f"uploads/ocr_pages/{secrets.token_hex(6)}_p{page_num}_{f.filename}"
                        with open(safe_path, "wb") as out_f:
                            out_f.write(file_bytes)

                        pages_input_data.append({
                            "page_number": page_num,
                            "raw_text": extracted.strip(),
                            "image_bytes": b"",
                            "mime_type": mime_type,
                            "image_path": safe_path,
                            "file_name": f"{f.filename} (Page {p_idx+1})"
                        })
                    else:
                        # Scanned PDF page without digital text -> Extract actual page image
                        page_img_bytes = b""
                        page_mime = "image/jpeg"
                        if hasattr(pdf_page, "images") and len(pdf_page.images) > 0:
                            best_img = max(pdf_page.images, key=lambda img: len(img.data))
                            page_img_bytes = best_img.data
                            page_mime = "image/jpeg" if ("jpg" in best_img.name.lower() or "jpeg" in best_img.name.lower()) else "image/png"

                        # Save extracted page image so teacher can view thumbnail in Review Studio
                        ext = "jpg" if "jpeg" in page_mime or "jpg" in page_mime else "png"
                        safe_path = f"uploads/ocr_pages/{secrets.token_hex(6)}_p{page_num}_page_{p_idx+1}.{ext}"
                        if page_img_bytes:
                            with open(safe_path, "wb") as out_f:
                                out_f.write(page_img_bytes)
                        else:
                            with open(safe_path, "wb") as out_f:
                                out_f.write(file_bytes)

                        pages_input_data.append({
                            "page_number": page_num,
                            "raw_text": "",
                            "image_bytes": page_img_bytes if page_img_bytes else file_bytes,
                            "mime_type": page_mime,
                            "image_path": safe_path,
                            "file_name": f"{f.filename} (Page {p_idx+1})"
                        })
            except Exception as e:
                # Fallback to single entry
                page_num = len(pages_input_data) + 1
                safe_path = f"uploads/ocr_pages/{secrets.token_hex(6)}_p{page_num}_{f.filename}"
                with open(safe_path, "wb") as out_f:
                    out_f.write(file_bytes)
                pages_input_data.append({
                    "page_number": page_num,
                    "image_bytes": file_bytes,
                    "mime_type": mime_type,
                    "image_path": safe_path,
                    "file_name": f.filename
                })
        else:
            page_num = len(pages_input_data) + 1
            safe_path = f"uploads/ocr_pages/{secrets.token_hex(6)}_p{page_num}_{f.filename}"
            with open(safe_path, "wb") as out_f:
                out_f.write(file_bytes)

            pages_input_data.append({
                "page_number": page_num,
                "image_bytes": file_bytes,
                "mime_type": mime_type,
                "image_path": safe_path,
                "file_name": f.filename
            })

    total_pages_count = len(pages_input_data)

    # Execute concurrent multi-page OCR across threads
    ocr_results = process_pages_batch_concurrent(
        pages_input_data,
        confidence_threshold=confidence_threshold,
        max_workers=min(12, total_pages_count)
    )

    processed_pages = []
    auto_accepted_count = 0
    needs_review_count = 0

    for idx, ocr_res in enumerate(ocr_results):
        page_num = ocr_res.get("page_number", idx + 1)
        img_path = pages_input_data[idx]["image_path"]

        page_record = SourcePage(
            source_id=source_id,
            source_version_id=source_version_id,
            teacher_id=current_teacher.id,
            page_number=page_num,
            image_path=img_path,
            ocr_raw_text=ocr_res["ocr_raw_text"],
            reviewed_text=ocr_res["reviewed_text"],
            confidence_score=ocr_res["confidence_score"],
            review_status=ocr_res["review_status"],
            uncertain_spans_json=json.dumps(ocr_res["uncertain_spans"]),
            ocr_provider=ocr_res.get("ocr_provider", "gemini_vision"),
            created_at=datetime.datetime.utcnow()
        )
        db.add(page_record)
        db.flush()

        if page_record.review_status == "auto_accepted":
            auto_accepted_count += 1
        elif page_record.review_status == "needs_review":
            needs_review_count += 1

        processed_pages.append(_format_source_page_response(page_record))

    db.commit()

    can_proceed = (needs_review_count == 0)

    summary_msg = f"{auto_accepted_count} of {total_pages_count} pages auto-accepted (≥{int(confidence_threshold*100)}% confidence). {needs_review_count} page(s) need your review."

    return {
        "total_pages": total_pages_count,
        "auto_accepted_count": auto_accepted_count,
        "needs_review_count": needs_review_count,
        "reviewed_count": 0,
        "can_proceed_to_chunking": can_proceed,
        "confidence_threshold": confidence_threshold,
        "message": summary_msg,
        "pages": processed_pages
    }


@router.get("/pages", response_model=List[OCRPageResponse])
def list_source_pages(
    source_id: Optional[int] = None,
    source_version_id: Optional[int] = None,
    review_status: Optional[str] = None, # 'needs_review', 'auto_accepted', 'reviewed', or None for all
    page_number: Optional[int] = None,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """
    Retrieves source pages for review.
    Enables review-by-exception filtering:
    - review_status='needs_review': Only flagged pages needing teacher review
    - review_status='auto_accepted': Only pages automatically accepted
    - review_status='reviewed': Already reviewed pages
    - None / 'all': All pages
    """
    query = db.query(SourcePage).filter(
        (SourcePage.teacher_id == current_teacher.id) | (SourcePage.teacher_id.is_(None))
    )

    if source_id is not None:
        query = query.filter(SourcePage.source_id == source_id)
    if source_version_id is not None:
        query = query.filter(SourcePage.source_version_id == source_version_id)
    if review_status and review_status != "all":
        query = query.filter(SourcePage.review_status == review_status)
    if page_number is not None:
        query = query.filter(SourcePage.page_number == page_number)

    pages = query.order_by(SourcePage.page_number.asc()).all()
    return [_format_source_page_response(p) for p in pages]


@router.get("/summary", response_model=OCRSummaryResponse)
def get_ocr_review_summary(
    source_id: Optional[int] = None,
    source_version_id: Optional[int] = None,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """
    Returns summary banner metrics:
    - Total pages
    - Auto-accepted count
    - Needs review count
    - Reviewed count
    - can_proceed_to_chunking (True if needs_review_count == 0)
    """
    query = db.query(SourcePage).filter(
        (SourcePage.teacher_id == current_teacher.id) | (SourcePage.teacher_id.is_(None))
    )
    if source_id is not None:
        query = query.filter(SourcePage.source_id == source_id)
    if source_version_id is not None:
        query = query.filter(SourcePage.source_version_id == source_version_id)

    pages = query.all()
    total_pages = len(pages)
    auto_accepted = sum(1 for p in pages if p.review_status == "auto_accepted")
    needs_review = sum(1 for p in pages if p.review_status == "needs_review")
    reviewed = sum(1 for p in pages if p.review_status == "reviewed")

    can_proceed = (needs_review == 0)

    return {
        "source_id": source_id,
        "total_pages": total_pages,
        "auto_accepted_count": auto_accepted,
        "needs_review_count": needs_review,
        "reviewed_count": reviewed,
        "can_proceed_to_chunking": can_proceed,
        "confidence_threshold": confidence_threshold
    }


@router.put("/pages/{page_id}/review", response_model=OCRPageResponse)
@router.post("/pages/{page_id}/review", response_model=OCRPageResponse)
def review_source_page(
    page_id: int,
    data: SourcePageReviewRequest,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """
    Reviews/edits a flagged page.
    Sets review_status='reviewed' and updates reviewed_text.
    """
    page = db.query(SourcePage).filter(SourcePage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Source page not found.")

    if data.reviewed_text is not None:
        page.reviewed_text = data.reviewed_text.strip()
    if data.review_status:
        page.review_status = data.review_status.strip().lower()
    else:
        page.review_status = "reviewed"
    if data.teacher_notes is not None:
        page.teacher_notes = data.teacher_notes.strip()

    page.reviewed_by = current_teacher.id
    page.reviewed_at = datetime.datetime.utcnow()
    page.updated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(page)
    return _format_source_page_response(page)


@router.post("/sources/{source_id}/accept-all")
def accept_all_pages_for_source(
    source_id: int,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """
    Bulk marks all remaining 'needs_review' pages for this source as 'reviewed'.
    Unblocks chunking immediately.
    """
    pages = db.query(SourcePage).filter(
        SourcePage.source_id == source_id,
        SourcePage.review_status == "needs_review"
    ).all()

    for p in pages:
        p.review_status = "reviewed"
        if not p.reviewed_text:
            p.reviewed_text = p.ocr_raw_text
        p.reviewed_by = current_teacher.id
        p.reviewed_at = datetime.datetime.utcnow()

    db.commit()
    return {
        "message": f"Successfully approved {len(pages)} page(s). All pages verified.",
        "accepted_count": len(pages),
        "can_proceed_to_chunking": True
    }


@router.get("/sources/{source_id}/consolidated-text")
def get_consolidated_source_text(
    source_id: int,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """
    Assembles the full curriculum source text from all pages in order.
    Checks if any page still has review_status='needs_review'.
    """
    pages = db.query(SourcePage).filter(
        SourcePage.source_id == source_id
    ).order_by(SourcePage.page_number.asc()).all()

    if not pages:
        raise HTTPException(status_code=404, detail="No source pages found for this source.")

    pending_review = [p.page_number for p in pages if p.review_status == "needs_review"]
    if pending_review:
        raise HTTPException(
            status_code=400,
            detail=f"Chunking blocked: Page(s) {pending_review} still require teacher review (review_status='needs_review')."
        )

    full_text_pieces = []
    for p in pages:
        text = p.reviewed_text or p.ocr_raw_text or ""
        if text.strip():
            full_text_pieces.append(text.strip())

    consolidated = "\n\n".join(full_text_pieces)
    return {
        "source_id": source_id,
        "total_pages": len(pages),
        "full_text": consolidated,
        "can_proceed_to_chunking": True
    }


@router.delete("/pages/{page_id}")
def delete_source_page(
    page_id: int,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """Deletes a source page record."""
    page = db.query(SourcePage).filter(SourcePage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Source page not found.")
    db.delete(page)
    db.commit()
    return {"message": f"Source page #{page_id} successfully deleted."}
