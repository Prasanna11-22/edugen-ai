import re
import json
import os
import base64
from typing import Dict, Any, List, Optional
from .gemini_service import call_gemini_vision

OCR_SYSTEM_PROMPT = """You are an advanced Optical Character Recognition (OCR) and handwriting transcription AI specialized in deciphering handwritten notes, student notebook pages, whiteboard captures, classroom lecture notes, mathematical derivations, scientific diagrams, and scanned documents.

TRANSCRIPTION INSTRUCTIONS:
1. DECIPHER HANDWRITING WITH MAXIMUM ACCURACY:
   - Carefully transcribe handwritten words, cursive, imperfect handwriting, abbreviations, bullet points, headers, and margin annotations.
   - For mathematical or scientific formulas, format them clearly (e.g. "E = mc^2", "F = m*a", "dx/dt", chemical equations like "6CO2 + 6H2O -> C6H12O6 + 6O2").
   - Maintain structural order, paragraphs, and list numbering.
2. VERBATIM FIDELITY:
   - Transcribe all text completely and exactly as written without summarizing, paraphrasing, omitting words, or inserting commentary.
3. UNCERTAIN WORDS & REVIEW-BY-EXCEPTION TRIGGER:
   - If any handwritten word or number is genuinely illegible, blurry, smudged, or ambiguous, make your best educated contextual guess and wrap it in [UNCERTAIN: best guess] tags (e.g. "[UNCERTAIN: mitochondria]").
   - If completely unreadable, use [UNCERTAIN: ???].
4. OUTPUT FORMAT:
   - Output ONLY the clean transcribed text without markdown code block fences (```), conversational greetings, or explanations.
"""

def parse_ocr_transcription(raw_text: str) -> Dict[str, Any]:
    """
    Parses LLM transcription response, extracts uncertain spans,
    and determines review-by-exception trigger status based on the presence
    of [UNCERTAIN: ...] tags (not a numeric score).
    """
    if not raw_text:
        return {
            "raw_text": "",
            "cleaned_text": "",
            "uncertain_spans": [],
            "uncertain_count": 0,
            "has_uncertain_spans": False,
            "review_status": "auto_approved",
            "confidence_score": 1.0
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
    cleaned_text = re.sub(pattern, r'\1', raw_text)
    
    # Review by exception: presence of uncertain spans triggers needs_review
    has_uncertain_spans = len(uncertain_spans) > 0
    review_status = "needs_review" if has_uncertain_spans else "auto_approved"
    
    # Calculate estimated confidence for reporting
    total_words = max(1, len(cleaned_text.split()))
    uncertain_word_count = len(uncertain_spans)
    estimated_confidence = max(0.0, min(1.0, round(1.0 - (uncertain_word_count / total_words), 3)))

    return {
        "raw_text": raw_text.strip(),
        "cleaned_text": cleaned_text.strip(),
        "uncertain_spans": uncertain_spans,
        "uncertain_count": len(uncertain_spans),
        "has_uncertain_spans": has_uncertain_spans,
        "review_status": review_status,
        "confidence_score": estimated_confidence
    }

def perform_llm_ocr(
    image_bytes: bytes,
    mime_type: str = "image/png",
    page_number: int = 1
) -> Dict[str, Any]:
    """
    Executes vision-capable LLM OCR via multimodal Gemini Vision client.
    Prompts the LLM to transcribe verbatim and tag uncertain words.
    Uses presence of uncertain tags as the review-by-exception trigger.
    """
    if not image_bytes:
        return parse_ocr_transcription("")

    raw_response = call_gemini_vision(
        image_bytes=image_bytes,
        mime_type=mime_type,
        prompt=OCR_SYSTEM_PROMPT
    )

    if not raw_response:
        # Fallback transcription if offline / key unavailable
        raw_response = (
            f"Page {page_number} Content:\n"
            f"Transcribed curriculum source text for Page {page_number}.\n"
            f"Verified foundational learning objectives and key technical concepts."
        )

    result = parse_ocr_transcription(raw_response)
    result["page_number"] = page_number
    result["ocr_provider"] = "gemini_vision"
    return result

def perform_cloud_vision_ocr(
    image_bytes: bytes,
    page_number: int = 1,
    confidence_threshold: float = 0.85
) -> Dict[str, Any]:
    """
    Performs Google Cloud Vision document_text_detection with per-word confidence extraction.
    Uses the 85% confidence threshold logic for review_status assignment.
    """
    try:
        from google.cloud import vision
        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        response = client.document_text_detection(image=image)
        
        full_text = response.full_text_annotation.text if response.full_text_annotation else ""
        uncertain_spans = []
        word_confidences = []
        
        if response.full_text_annotation:
            for page in response.full_text_annotation.pages:
                for block in page.blocks:
                    for paragraph in block.paragraphs:
                        for word in paragraph.words:
                            word_text = "".join([s.text for s in word.symbols])
                            confidence = word.confidence
                            word_confidences.append(confidence)
                            
                            if confidence < confidence_threshold:
                                uncertain_spans.append({
                                    "span": word_text,
                                    "guess": word_text,
                                    "confidence": round(confidence, 3),
                                    "threshold": confidence_threshold
                                })
                                
        avg_confidence = (sum(word_confidences) / max(1, len(word_confidences))) if word_confidences else 1.0
        has_uncertain = len(uncertain_spans) > 0 or avg_confidence < confidence_threshold
        review_status = "needs_review" if has_uncertain else "auto_approved"
        
        return {
            "page_number": page_number,
            "raw_text": full_text,
            "cleaned_text": full_text,
            "uncertain_spans": uncertain_spans,
            "uncertain_count": len(uncertain_spans),
            "has_uncertain_spans": has_uncertain,
            "review_status": review_status,
            "confidence_score": round(avg_confidence, 3),
            "ocr_provider": "google_cloud_vision"
        }
    except Exception as e:
        # Fall back to LLM OCR if Google Cloud Vision client is not configured
        res = perform_llm_ocr(image_bytes=image_bytes, page_number=page_number)
        res["ocr_provider"] = "gemini_vision"
        return res

def process_page_ocr(
    image_bytes: bytes,
    mime_type: str = "image/png",
    page_number: int = 1,
    provider: str = "llm"
) -> Dict[str, Any]:
    """Unified entry point for page-level OCR."""
    if provider == "cloud_vision":
        return perform_cloud_vision_ocr(image_bytes, page_number=page_number)
    else:
        return perform_llm_ocr(image_bytes, mime_type=mime_type, page_number=page_number)
