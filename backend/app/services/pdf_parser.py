import io
import re
from typing import Optional, Tuple
from pypdf import PdfReader
from PIL import Image, ImageOps, ImageEnhance
from .gemini_service import call_gemini_vision

def optimize_image_for_ocr(image_bytes: bytes, max_dimension: int = 2048) -> Tuple[bytes, str]:
    """
    Optimizes and auto-orients images (mobile captures, scans, photos) for maximum OCR accuracy.
    - Corrects EXIF orientation so sideways smartphone images are right-side up.
    - Converts all color modes (RGBA, CMYK, P) to clean RGB.
    - Resizes high-megapixel photos to max 2048px to prevent payload timeouts while retaining crisp text.
    - Mild contrast enhancement to bring out faint pencil or pen handwriting.
    """
    if not image_bytes:
        return image_bytes, "image/jpeg"
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img)
        
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        elif img.mode == "RGBA":
            img = img.convert("RGB")

        w, h = img.size
        if max(w, h) > max_dimension:
            scale = max_dimension / max(w, h)
            new_size = (int(w * scale), int(h * scale))
            img = img.resize(new_size, Image.Resampling.LANCZOS)

        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.15)

        out_buf = io.BytesIO()
        img.save(out_buf, format="JPEG", quality=88, optimize=True)
        return out_buf.getvalue(), "image/jpeg"
    except Exception as e:
        print(f"[Image Optimizer Warning] {e}")
        return image_bytes, "image/jpeg"

def extract_text_from_file_or_image(file_bytes: bytes, filename: str) -> str:
    """
    Unified extraction pipeline supporting PDF, text, and handwritten/scanned images
    (.png, .jpg, .jpeg, .webp, .bmp, .tiff, .heic) with automatic multimodal vision OCR fallback.
    """
    if not file_bytes:
        return ""
        
    fn_lower = filename.lower() if filename else ""

    # 1. Direct Image Formats (Handwritten notebook photos, whiteboard captures, scanned pages)
    image_exts = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".tiff": "image/tiff",
        ".heic": "image/heic",
        ".heif": "image/heif"
    }

    matched_ext = next((ext for ext in image_exts if fn_lower.endswith(ext)), None)
    if matched_ext:
        opt_bytes, opt_mime = optimize_image_for_ocr(file_bytes)
        ocr_text = call_gemini_vision(opt_bytes, mime_type=opt_mime)
        if ocr_text:
            return clean_extracted_text(ocr_text)
        return ""

    # 2. PDF Documents (Embedded text or Scanned/Handwritten PDF)
    if fn_lower.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)

    # 3. Plain Text Fallback
    try:
        decoded = file_bytes.decode("utf-8")
        return clean_extracted_text(decoded)
    except Exception:
        try:
            decoded = file_bytes.decode("latin-1", errors="ignore")
            return clean_extracted_text(decoded)
        except Exception:
            return ""

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract clean text from PDF bytes; automatically falls back to multimodal Vision OCR if scanned/handwritten."""
    if not file_bytes:
        return ""
    try:
        stream = io.BytesIO(file_bytes)
        reader = PdfReader(stream)
        pages_text = []
        for i, page in enumerate(reader.pages):
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            if text:
                lower_text = text.lower()
                if i < 3 and ("acknowledgments" in lower_text or "creative commons" in lower_text or "zero textbook cost" in lower_text):
                    continue
                pages_text.append(text)
                
        full_text = "\n\n".join(pages_text)
        cleaned = clean_extracted_text(full_text)
        
        # If PDF is scanned or handwritten, embedded text is empty or very short (< 40 chars)
        if len(cleaned.strip()) < 40:
            print("[PDF Parser] Scanned or handwritten PDF detected. Extracting embedded images or running multimodal Vision OCR...")
            
            # Check for embedded page images in PDF
            extracted_img_texts = []
            try:
                for p_idx, page in enumerate(reader.pages):
                    for img_obj in getattr(page, "images", []):
                        opt_img, opt_mime = optimize_image_for_ocr(img_obj.data)
                        page_ocr = call_gemini_vision(opt_img, mime_type=opt_mime)
                        if page_ocr and len(page_ocr.strip()) > 5:
                            extracted_img_texts.append(page_ocr.strip())
            except Exception as img_err:
                print(f"[PDF Image Extraction Note] {img_err}")
                
            if extracted_img_texts:
                return clean_extracted_text("\n\n".join(extracted_img_texts))

            # Fallback directly passing PDF
            vision_text = call_gemini_vision(file_bytes, mime_type="application/pdf")
            if vision_text and len(vision_text.strip()) > 5:
                return clean_extracted_text(vision_text)
                
        return cleaned
    except Exception as e:
        print(f"[PDF Parser Error] {e}. Trying multimodal Vision OCR...")
        try:
            vision_text = call_gemini_vision(file_bytes, mime_type="application/pdf")
            if vision_text:
                return clean_extracted_text(vision_text)
        except Exception:
            pass
        return ""

def clean_extracted_text(text: str) -> str:
    """Normalize whitespace, repair broken PDF word splits, remove NUL characters, page headers/footers, grants, and boilerplate."""
    if not text:
        return ""
    
    # Strictly strip PostgreSQL-incompatible NUL (0x00) characters and invalid controls
    text = text.replace('\x00', '')
    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', '', text)
    
    # Remove page number headers/footers, figure tags, and document titles
    text = re.sub(r'---\s*Page\s*\d+\s*---', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Introduction to Large Language Models\s+Page\s*-\s*\d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Page\s*-\s*\d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\b\d+\s+Operating\s+Systems\s+\d+\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bFigure\s*\d+[\.\d]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bTable\s*\d+[\.\d]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'by\s+Ahn\s+Nuzen', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Grossmont\s+College.*?(Fall|Spring|Summer)?\s*\d{4}', '', text, flags=re.IGNORECASE)
    text = re.sub(r'This\s+ZBook\s+was\s+made\s+possible\s+through\s+funding.*?(Grant|education)\.?', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'The\s+author\s+extends\s+his\s+genuine\s+thanks.*?(ZBook|work)\.?', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'This\s+work\s+is\s+licensed\s+under\s+a\s+Creative\s+Commons.*?(https?://[^\s]+)', '', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'https?://\S+', '', text)
    
    # Repair common PDF hyphenation and glued word joins
    text = re.sub(r'\bpres\s+ented\b', 'presented', text, flags=re.IGNORECASE)
    text = re.sub(r'\bdes\s+ign\b', 'design', text, flags=re.IGNORECASE)
    text = re.sub(r'\blevelsof\b', 'levels of', text, flags=re.IGNORECASE)
    text = re.sub(r'\bprinciplesapplied\b', 'principles applied', text, flags=re.IGNORECASE)
    text = re.sub(r'\binterfacesprovided\b', 'interfaces provided', text, flags=re.IGNORECASE)
    text = re.sub(r'\blineinterpreter\b', 'line interpreter', text, flags=re.IGNORECASE)
    text = re.sub(r'\bAprogram\b', 'A program', text)
    text = re.sub(r'\bAnoperating\b', 'An operating', text)
    text = re.sub(r'\bLinusTorvalds\b', 'Linus Torvalds', text)
    
    # Fix glued words where articles/prepositions are joined to capitalized words
    text = re.sub(r'\b([Aa]n?|[Tt]he|[Tt]his|[Ee]ach|[Ss]ome|[Aa]ll|[Ff]or|[Ww]ith|[Ff]rom)([A-Z][a-z]+)\b', r'\1 \2', text)
    # Fix standard lowercase-to-uppercase glue (e.g. wordBoundary -> word Boundary)
    text = re.sub(r'([a-z]{2,})([A-Z][a-z]{2,})', r'\1 \2', text)
    
    # Normalize whitespace
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()
