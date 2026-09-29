import os
import json
import re
import time
import requests
from typing import List, Dict, Any, Optional

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

CANDIDATE_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-flash-latest"
]

# Higher resolution and quality = better OCR accuracy, especially for small handwriting
OCR_MAX_DIM = 2048
OCR_JPEG_QUALITY = 92


def optimize_image_for_ocr(image_bytes: bytes, max_dim: int = OCR_MAX_DIM) -> tuple[bytes, str]:
    """
    Resizes and compresses large images for fast, accurate Gemini Vision OCR.
    Uses 2048px / 92% JPEG quality — enough for clear handwriting and small fonts.
    Handles all PIL colour modes (RGBA, P, L, LA, RGB).
    """
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(image_bytes))

        # Normalise colour mode to RGB (JPEG requires it)
        if img.mode != "RGB":
            img = img.convert("RGB")

        w, h = img.size
        if max(w, h) > max_dim:
            scale = max_dim / float(max(w, h))
            new_w, new_h = int(w * scale), int(h * scale)
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        out_buf = io.BytesIO()
        img.save(out_buf, format="JPEG", quality=OCR_JPEG_QUALITY, optimize=True)
        return out_buf.getvalue(), "image/jpeg"
    except Exception:
        return image_bytes, "image/jpeg"


def _post_fast(url: str, payload: dict, timeout: int) -> Optional[requests.Response]:
    """
    Single-attempt POST for Gemini JSON calls.
    On any non-200 (including 429), returns None immediately so the caller
    can try the next model — no sleeping, keeping lesson generation fast.
    """
    try:
        res = requests.post(
            url, json=payload,
            headers={"Content-Type": "application/json"},
            timeout=timeout
        )
        return res if res.status_code == 200 else None
    except Exception:
        return None


def _post_with_backoff(url: str, payload: dict, timeout: int, max_retries: int = 3) -> Optional[requests.Response]:
    """
    POST with exponential backoff on 429 for vision/OCR calls.
    Retries the SAME model up to max_retries times before giving up.
    Only used by call_gemini_vision — not by JSON calls.
    """
    for attempt in range(max_retries):
        try:
            res = requests.post(
                url, json=payload,
                headers={"Content-Type": "application/json"},
                timeout=timeout
            )
            if res.status_code == 200:
                return res
            elif res.status_code == 429:
                time.sleep(2 ** (attempt + 1))   # 2s → 4s → 8s
                continue
            else:
                return None     # 404/503 → try next model
        except Exception:
            return None
    return None


def call_gemini_json(prompt: str, system_instruction: Optional[str] = None, timeout: int = 15) -> Optional[Dict[str, Any]]:
    """
    Calls Gemini API with structured JSON output and fast model fallthrough.
    Does NOT sleep on 429 — immediately tries the next candidate model.
    This keeps lesson generation, glossary extraction, and quiz generation fast.
    """
    api_key = os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY
    if not api_key:
        return None

    parts_text = (
        f"System Instructions:\n{system_instruction}\n\nTask:\n{prompt}"
        if system_instruction else prompt
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": parts_text}]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.2}
    }

    for model in CANDIDATE_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        res = _post_fast(url, payload, timeout)
        if res is None:
            continue
        try:
            data = res.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    raw_text = parts[0].get("text", "").strip()
                    raw_text = re.sub(r'^```json\s*', '', raw_text)
                    raw_text = re.sub(r'\s*```$', '', raw_text)
                    return json.loads(raw_text)
        except Exception:
            continue

    return None


def call_gemini_vision(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    prompt: Optional[str] = None,
    timeout: int = 20
) -> Optional[str]:
    """
    Calls Gemini Multimodal Vision API with image payload, rate-limit retry, and model fallover.
    - Optimises image: 2048px max / 92% JPEG before upload (10-50x smaller payload)
    - 429 rate-limit → exponential backoff before retrying same model
    - Falls through all CANDIDATE_MODELS before returning None
    """
    import base64
    api_key = os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY
    if not api_key or not image_bytes:
        return None

    opt_bytes, opt_mime = optimize_image_for_ocr(image_bytes)
    b64_img = base64.b64encode(opt_bytes).decode("utf-8")

    prompt_text = prompt or (
        "You are an expert OCR transcription engine. Transcribe all text, formulas, diagrams, and handwriting "
        "from this educational page verbatim. For any words or characters that are ambiguous, blurry, cut off, "
        "or uncertain, wrap them in [UNCERTAIN: best guess]. Maintain original paragraphing."
    )

    for model in CANDIDATE_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": prompt_text},
                        {"inline_data": {"mime_type": opt_mime, "data": b64_img}}
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.1}
        }

        res = _post_with_backoff(url, payload, timeout)
        if res is None:
            continue
        try:
            data = res.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    text = parts[0].get("text", "").strip()
                    if text:
                        return text
        except Exception:
            continue

    return None
