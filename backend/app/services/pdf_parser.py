import io
import re
from typing import Optional
from pypdf import PdfReader

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract clean, substantive text from PDF bytes with layout-aware normalization and metadata stripping."""
    if not file_bytes:
        return ""
    try:
        stream = io.BytesIO(file_bytes)
        reader = PdfReader(stream)
        pages_text = []
        for i, page in enumerate(reader.pages):
            try:
                text = page.extract_text()
            except Exception as pe:
                text = ""
            if text:
                # Check if page is solely acknowledgment / title / license boilerplate
                lower_text = text.lower()
                if i < 3 and ("acknowledgments" in lower_text or "creative commons" in lower_text or "zero textbook cost" in lower_text):
                    continue
                pages_text.append(text)
        full_text = "\n\n".join(pages_text)
        return clean_extracted_text(full_text)
    except Exception as e:
        print(f"[PDF Parser Error] {e}")
        # Safe fallback: extract only printable text characters, strictly avoiding binary / NUL bytes
        try:
            # Match sequences of printable characters
            extracted = re.findall(rb'[\x20-\x7E\r\n\t]{4,}', file_bytes)
            decoded = b" ".join(extracted).decode('utf-8', errors='ignore')
            return clean_extracted_text(decoded)
        except Exception:
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
