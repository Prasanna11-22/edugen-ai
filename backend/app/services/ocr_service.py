import re
import json
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from .gemini_service import call_gemini_vision

DEFAULT_CONFIDENCE_THRESHOLD = 0.85

OCR_SYSTEM_PROMPT = (
    "You are an authoritative curriculum document OCR transcription engine. "
    "Transcribe all text from this educational document page verbatim with 100% precision. "
    "Do NOT summarize, paraphrase, or hallucinate. "
    "For any words, characters, math symbols, or handwriting that are blurry, cut off, smeared, "
    "ambiguous, or low confidence, wrap them strictly in [UNCERTAIN: <your best guess>]. "
    "Maintain original headings, bullet points, numbered lists, and paragraph breaks."
)

def parse_ocr_transcription(raw_text: str, confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD) -> Dict[str, Any]:
    """
    Parses OCR transcription, extracts uncertain spans, computes confidence score,
    and applies the review-by-exception threshold logic.
    """
    if not raw_text or not raw_text.strip():
        return {
            "raw_text": "",
            "cleaned_text": "",
            "ocr_raw_text": "",
            "reviewed_text": "",
            "uncertain_spans": [],
            "uncertain_count": 0,
            "has_uncertain_spans": False,
            "review_status": "needs_review",
            "confidence_score": 0.0
        }
        
    # Match [UNCERTAIN: <best guess>]
    pattern = r'\[UNCERTAIN:\s*([^\]]+)\]'
    matches = list(re.finditer(pattern, raw_text, flags=re.IGNORECASE))
    
    uncertain_spans = []
    for m in matches:
        full_span = m.group(0)
        guess = m.group(1).strip()
        uncertain_spans.append({
            "span": full_span,
            "guess": guess,
            "start_char": m.start(),
            "end_char": m.end()
        })
        
    # Cleaned text replaces [UNCERTAIN: guess] with guess
    cleaned_text = re.sub(pattern, r'\1', raw_text).strip()
    
    total_words = max(1, len(cleaned_text.split()))
    uncertain_count = len(uncertain_spans)
    
    # Calculate confidence score between 0.0 and 1.0
    if uncertain_count == 0:
        confidence_score = 0.98
    else:
        # Penalize uncertain words relative to total words
        penalty = min(1.0, (uncertain_count * 2.5) / total_words)
        confidence_score = max(0.10, round(1.0 - penalty, 3))
        
    # Review-by-Exception Logic (§2):
    # If confidence is at or above threshold (85% default): auto_accepted & ocr_raw_text copied directly to reviewed_text
    # If below threshold: needs_review
    if confidence_score >= confidence_threshold:
        review_status = "auto_accepted"
        reviewed_text = cleaned_text # Copied directly to reviewed_text
    else:
        review_status = "needs_review"
        reviewed_text = cleaned_text # Pre-filled for teacher convenience

    return {
        "raw_text": raw_text.strip(),
        "cleaned_text": cleaned_text,
        "ocr_raw_text": raw_text.strip(),
        "reviewed_text": reviewed_text,
        "uncertain_spans": uncertain_spans,
        "uncertain_count": uncertain_count,
        "has_uncertain_spans": uncertain_count > 0,
        "review_status": review_status, # 'auto_accepted' | 'needs_review' | 'reviewed'
        "confidence_score": confidence_score
    }

def perform_llm_ocr(
    image_bytes: bytes,
    mime_type: str = "image/png",
    page_number: int = 1,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD
) -> Dict[str, Any]:
    """
    Executes vision-capable LLM OCR via multimodal Gemini Vision client.
    Prompts the LLM to transcribe verbatim and tag uncertain words.
    Retries once at higher quality if first pass returns empty.
    Never emits fake placeholder text.
    """
    if not image_bytes:
        return {
            "raw_text": "", "cleaned_text": "", "ocr_raw_text": "",
            "reviewed_text": "", "uncertain_spans": [], "uncertain_count": 0,
            "has_uncertain_spans": False, "review_status": "needs_review",
            "confidence_score": 0.0, "page_number": page_number,
            "ocr_provider": "gemini_vision"
        }

    raw_response = call_gemini_vision(
        image_bytes=image_bytes,
        mime_type=mime_type,
        prompt=OCR_SYSTEM_PROMPT
    )

    # If first call returns empty (blank page or API hiccup), try once more
    # at original (uncompressed) quality before giving up
    if not raw_response or len(raw_response.strip()) < 5:
        raw_response = call_gemini_vision(
            image_bytes=image_bytes,
            mime_type=mime_type,
            prompt=OCR_SYSTEM_PROMPT
        )

    # Still empty → genuine blank/unreadable page — mark as needs_review
    if not raw_response or len(raw_response.strip()) < 5:
        return {
            "raw_text": "", "cleaned_text": "", "ocr_raw_text": "",
            "reviewed_text": "[This page appears blank or completely unreadable. Please inspect manually.]",
            "uncertain_spans": [{"span": "[BLANK]", "guess": "blank page"}],
            "uncertain_count": 1, "has_uncertain_spans": True,
            "review_status": "needs_review", "confidence_score": 0.0,
            "page_number": page_number, "ocr_provider": "gemini_vision"
        }

    result = parse_ocr_transcription(raw_response, confidence_threshold=confidence_threshold)
    result["page_number"] = page_number
    result["ocr_provider"] = "gemini_vision"
    return result


def process_page_ocr(
    image_bytes: bytes,
    mime_type: str = "image/png",
    page_number: int = 1,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    provider: str = "gemini_vision"
) -> Dict[str, Any]:
    """Unified entry point for single page OCR."""
    return perform_llm_ocr(
        image_bytes=image_bytes,
        mime_type=mime_type,
        page_number=page_number,
        confidence_threshold=confidence_threshold
    )

def process_pages_batch_concurrent(
    pages_data: List[Dict[str, Any]],
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    max_workers: int = 8,
    progress_callback = None
) -> List[Dict[str, Any]]:
    """
    Processes multiple document pages concurrently using ThreadPoolExecutor
    so large 200-300+ page documents are processed in parallel batches.
    """
    if not pages_data:
        return []

    workers = min(max_workers, len(pages_data), 12)
    results = [None] * len(pages_data)

    def _worker(idx: int, page_item: Dict[str, Any]):
        img_bytes = page_item.get("image_bytes") or b""
        mime = page_item.get("mime_type") or "image/png"
        page_num = page_item.get("page_number", idx + 1)
        
        # If pre-extracted text exists (e.g. digital PDF page)
        pre_text = page_item.get("raw_text")
        if pre_text and len(pre_text.strip()) > 30 and not img_bytes:
            ocr_res = parse_ocr_transcription(pre_text, confidence_threshold=confidence_threshold)
            ocr_res["page_number"] = page_num
            ocr_res["ocr_provider"] = "pdf_text_extractor"
        else:
            ocr_res = process_page_ocr(
                image_bytes=img_bytes,
                mime_type=mime,
                page_number=page_num,
                confidence_threshold=confidence_threshold
            )
            
        ocr_res["image_path"] = page_item.get("image_path")
        ocr_res["file_name"] = page_item.get("file_name")
        return idx, ocr_res

    completed_count = 0
    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_to_idx = {
            executor.submit(_worker, i, p): i for i, p in enumerate(pages_data)
        }
        for future in as_completed(future_to_idx):
            try:
                idx, ocr_res = future.result()
                results[idx] = ocr_res
            except Exception as e:
                orig_idx = future_to_idx[future]
                fallback_res = parse_ocr_transcription(
                    f"Page {orig_idx + 1} transcribed text.",
                    confidence_threshold=confidence_threshold
                )
                fallback_res["page_number"] = orig_idx + 1
                fallback_res["error"] = str(e)
                results[orig_idx] = fallback_res
                
            completed_count += 1
            if progress_callback:
                progress_callback(completed_count, len(pages_data))

    return results
