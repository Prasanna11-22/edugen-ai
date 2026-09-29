import json
import os
import secrets
import base64
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Source, SourceVersion, SourcePage
from ..schemas import SourcePageReviewRequest, OCRPageResponse, BatchOCRResponse
from ..auth import teacher_required
from ..services.ocr_service import process_page_ocr, parse_ocr_transcription

router = APIRouter(prefix="/api/ocr", tags=["OCR & Document Processing"])

def _format_source_page_response(page: SourcePage) -> dict:
    try:
        uncertain_spans = json.loads(page.uncertain_spans_json) if page.uncertain_spans_json else []
    except Exception:
        uncertain_spans = []
        
    return {
        "id": page.id,
        "page_number": page.page_number,
        "source_id": page.source_id,
        "source_version_id": page.source_version_id,
        "raw_text": page.raw_text,
        "cleaned_text": page.cleaned_text,
        "review_status": page.review_status,
        "has_uncertain_spans": len(uncertain_spans) > 0,
        "uncertain_spans": uncertain_spans,
        "uncertain_count": len(uncertain_spans),
        "ocr_provider": page.ocr_provider,
        "image_path": page.image_path,
        "confidence_score": page.confidence_score,
        "reviewed_by": page.reviewed_by,
        "reviewed_at": page.reviewed_at,
        "teacher_notes": page.teacher_notes,
        "created_at": page.created_at
    }

@router.post("/page", response_model=OCRPageResponse)
async def process_single_page_ocr(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    page_number: int = Form(1),
    source_id: Optional[int] = Form(None),
    source_version_id: Optional[int] = Form(None),
    provider: str = Form("gemini_vision"),
    save_to_db: bool = Form(True),
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """
    Performs vision-capable OCR transcription on a document/page image.
    Extracts verbatim text, wraps uncertain words in [UNCERTAIN: best guess] tags,
    and uses their presence as the review-by-exception trigger to set review_status ('needs_review' vs 'auto_approved').
    Saves and indexes the result in the source_pages table.
    """
    image_bytes = b""
    mime_type = "image/png"
    image_path = None

    if file:
        image_bytes = await file.read()
        mime_type = file.content_type or "image/png"
        
        # Save uploaded image locally for visual review
        os.makedirs("uploads/ocr_pages", exist_ok=True)
        safe_filename = f"uploads/ocr_pages/{secrets.token_hex(6)}_{file.filename}"
        with open(safe_filename, "wb") as f:
            f.write(image_bytes)
        image_path = safe_filename

    elif image_base64:
        raw_b64 = image_base64.strip()
        if "base64," in raw_b64:
            header, raw_b64 = raw_b64.split("base64,", 1)
            if "image/" in header:
                mime_type = header.split("image/")[1].split(";")[0]
                mime_type = f"image/{mime_type}"
        try:
            image_bytes = base64.b64decode(raw_b64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 image data provided.")

        os.makedirs("uploads/ocr_pages", exist_ok=True)
        image_path = f"uploads/ocr_pages/{secrets.token_hex(6)}_page_{page_number}.png"
        with open(image_path, "wb") as f:
            f.write(image_bytes)
    else:
        raise HTTPException(status_code=400, detail="Please upload an image file or provide a base64 encoded image.")

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Execute OCR processing
    ocr_result = process_page_ocr(
        image_bytes=image_bytes,
        mime_type=mime_type,
        page_number=page_number,
        provider=provider
    )

    page_record = None
    if save_to_db:
        # Check if page already exists for this source version
        if source_version_id:
            page_record = db.query(SourcePage).filter(
                SourcePage.source_version_id == source_version_id,
                SourcePage.page_number == page_number
            ).first()

        if page_record:
            page_record.raw_text = ocr_result["raw_text"]
            page_record.cleaned_text = ocr_result["cleaned_text"]
            page_record.review_status = ocr_result["review_status"]
            page_record.uncertain_spans_json = json.dumps(ocr_result["uncertain_spans"])
            page_record.confidence_score = ocr_result.get("confidence_score")
            page_record.ocr_provider = ocr_result["ocr_provider"]
            page_record.image_path = image_path or page_record.image_path
            page_record.updated_at = datetime.datetime.utcnow()
        else:
            page_record = SourcePage(
                source_id=source_id,
                source_version_id=source_version_id,
                teacher_id=current_teacher.id,
                page_number=page_number,
                image_path=image_path,
                raw_text=ocr_result["raw_text"],
                cleaned_text=ocr_result["cleaned_text"],
                ocr_provider=ocr_result["ocr_provider"],
                review_status=ocr_result["review_status"],
                uncertain_spans_json=json.dumps(ocr_result["uncertain_spans"]),
                confidence_score=ocr_result.get("confidence_score"),
                created_at=datetime.datetime.utcnow()
            )
            db.add(page_record)

        db.commit()
        db.refresh(page_record)
        return _format_source_page_response(page_record)

    # If not saving to DB, return in-memory structure
    return {
        "id": None,
        "page_number": page_number,
        "source_id": source_id,
        "source_version_id": source_version_id,
        "raw_text": ocr_result["raw_text"],
        "cleaned_text": ocr_result["cleaned_text"],
        "review_status": ocr_result["review_status"],
        "has_uncertain_spans": ocr_result["has_uncertain_spans"],
        "uncertain_spans": ocr_result["uncertain_spans"],
        "uncertain_count": ocr_result["uncertain_count"],
        "ocr_provider": ocr_result["ocr_provider"],
        "image_path": image_path,
        "confidence_score": ocr_result.get("confidence_score"),
        "reviewed_by": None,
        "reviewed_at": None,
        "teacher_notes": None,
        "created_at": datetime.datetime.utcnow()
    }

@router.get("/pages", response_model=List[OCRPageResponse])
def list_source_pages(
    source_id: Optional[int] = None,
    source_version_id: Optional[int] = None,
    review_status: Optional[str] = None, # needs_review, auto_approved, approved, rejected
    page_number: Optional[int] = None,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """
    Retrieves OCR source pages from the source_pages table.
    Enables review-by-exception filtering (e.g. review_status='needs_review').
    """
    query = db.query(SourcePage).filter(
        (SourcePage.teacher_id == current_teacher.id) | (SourcePage.teacher_id.is_(None))
    )

    if source_id is not None:
        query = query.filter(SourcePage.source_id == source_id)
    if source_version_id is not None:
        query = query.filter(SourcePage.source_version_id == source_version_id)
    if review_status:
        query = query.filter(SourcePage.review_status == review_status)
    if page_number is not None:
        query = query.filter(SourcePage.page_number == page_number)

    pages = query.order_by(SourcePage.source_version_id.asc(), SourcePage.page_number.asc()).all()
    return [_format_source_page_response(p) for p in pages]

@router.get("/pages/{page_id}", response_model=OCRPageResponse)
def get_source_page_detail(
    page_id: int,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """Retrieves single source page record with highlighted uncertain spans."""
    page = db.query(SourcePage).filter(SourcePage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Source page not found.")
    return _format_source_page_response(page)

@router.put("/pages/{page_id}/review", response_model=OCRPageResponse)
@router.post("/pages/{page_id}/review", response_model=OCRPageResponse)
def review_source_page(
    page_id: int,
    review_data: SourcePageReviewRequest,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """
    Completes the review-by-exception workflow for a flagged source page.
    Allows teacher to approve, reject, or edit cleaned_text for downstream RAG chunking.
    """
    page = db.query(SourcePage).filter(SourcePage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Source page not found.")

    if review_data.cleaned_text is not None:
        page.cleaned_text = review_data.cleaned_text.strip()
    if review_data.review_status:
        page.review_status = review_data.review_status.strip().lower()
    if review_data.teacher_notes is not None:
        page.teacher_notes = review_data.teacher_notes.strip()

    page.reviewed_by = current_teacher.id
    page.reviewed_at = datetime.datetime.utcnow()
    page.updated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(page)
    return _format_source_page_response(page)

@router.post("/batch", response_model=BatchOCRResponse)
async def process_batch_ocr(
    files: List[UploadFile] = File(...),
    source_id: Optional[int] = Form(None),
    source_version_id: Optional[int] = Form(None),
    provider: str = Form("gemini_vision"),
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    """
    Batch processes multiple document page images.
    Performs OCR, saves each page into source_pages table,
    and returns review-by-exception breakdown.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided for batch processing.")

    processed_pages = []
    needs_review_count = 0
    auto_approved_count = 0

    for idx, f in enumerate(files):
        page_num = idx + 1
        file_bytes = await f.read()
        mime_type = f.content_type or "image/png"

        os.makedirs("uploads/ocr_pages", exist_ok=True)
        safe_path = f"uploads/ocr_pages/{secrets.token_hex(6)}_p{page_num}_{f.filename}"
        with open(safe_path, "wb") as out_f:
            out_f.write(file_bytes)

        ocr_result = process_page_ocr(
            image_bytes=file_bytes,
            mime_type=mime_type,
            page_number=page_num,
            provider=provider
        )

        page_record = SourcePage(
            source_id=source_id,
            source_version_id=source_version_id,
            teacher_id=current_teacher.id,
            page_number=page_num,
            image_path=safe_path,
            raw_text=ocr_result["raw_text"],
            cleaned_text=ocr_result["cleaned_text"],
            ocr_provider=ocr_result["ocr_provider"],
            review_status=ocr_result["review_status"],
            uncertain_spans_json=json.dumps(ocr_result["uncertain_spans"]),
            confidence_score=ocr_result.get("confidence_score"),
            created_at=datetime.datetime.utcnow()
        )
        db.add(page_record)
        db.commit()
        db.refresh(page_record)

        formatted = _format_source_page_response(page_record)
        processed_pages.append(formatted)

        if page_record.review_status == "needs_review":
            needs_review_count += 1
        else:
            auto_approved_count += 1

    return {
        "total_pages": len(files),
        "processed_pages": len(processed_pages),
        "needs_review_count": needs_review_count,
        "auto_approved_count": auto_approved_count,
        "pages": processed_pages,
        "message": f"Successfully processed {len(processed_pages)} pages. {needs_review_count} page(s) flagged for teacher exception review."
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
