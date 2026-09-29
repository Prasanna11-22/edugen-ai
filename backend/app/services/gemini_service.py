import os
import json
import re
import base64
import requests
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash"
]

def call_gemini_json(prompt: str, system_instruction: Optional[str] = None, timeout: int = 25) -> Optional[Dict[str, Any]]:
    """Calls Gemini API with structured JSON output enforcement and automatic model fallback."""
    api_key = os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY
    if not api_key:
        return None

    for model in CANDIDATE_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        
        contents = []
        if system_instruction:
            contents.append({
                "role": "user",
                "parts": [{"text": f"System Instructions:\n{system_instruction}\n\nTask:\n{prompt}"}]
            })
        else:
            contents.append({
                "role": "user",
                "parts": [{"text": prompt}]
            })
            
        payload = {
            "contents": contents,
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.2
            }
        }
        
        try:
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=timeout)
            if res.status_code == 200:
                data = res.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        raw_text = parts[0].get("text", "").strip()
                        # Clean code fence if present
                        raw_text = re.sub(r'^```json\s*', '', raw_text)
                        raw_text = re.sub(r'\s*```$', '', raw_text)
                        parsed = json.loads(raw_text)
                        return parsed
            else:
                # If 503 or 404, try next candidate model
                continue
        except Exception as e:
            continue
            
    return None

VISION_MODELS = [
    "gemini-2.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-lite-latest"
]

def call_gemini_vision(
    image_bytes: bytes,
    mime_type: str = "image/png",
    prompt: Optional[str] = None,
    timeout: int = 15
) -> Optional[str]:
    """
    Calls multimodal vision Gemini model to perform high-fidelity OCR transcription.
    Sends raw image bytes as inline_data with exact transcription instructions.
    """
    api_key = os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY
    if not api_key or not image_bytes:
        return None

    ocr_prompt = prompt or (
        "You are an expert Optical Character Recognition (OCR) engine.\n"
        "Transcribe all text from the provided document image accurately, completely, and verbatim.\n"
        "CRITICAL INSTRUCTION: If any word, number, or symbol is illegible, blurry, or uncertain, wrap it in [UNCERTAIN: best guess] tags.\n"
        "Output ONLY the transcribed text."
    )

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    for model in VISION_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {"text": ocr_prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": image_b64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1
            }
        }

        try:
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=timeout)
            if res.status_code == 200:
                data = res.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        text_val = parts[0].get("text", "").strip()
                        if text_val:
                            return text_val
            else:
                continue
        except Exception:
            continue

    return None

