import os
import json
import re
import requests
from typing import List, Dict, Any, Optional

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
