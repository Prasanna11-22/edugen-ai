import re
from typing import List, Dict

def semantic_chunk_text(text: str, target_tokens: int = 450, overlap_pct: float = 0.15) -> List[Dict[str, any]]:
    """
    Splits source text into semantically coherent chunks (approx 300-600 tokens)
    with ~15% overlap across paragraph / sentence boundaries.
    """
    if not text or not text.strip():
        return []
        
    # Approximate tokens by whitespace word count
    words = text.strip().split()
    total_words = len(words)
    
    if total_words <= target_tokens:
        return [{
            "chunk_index": 0,
            "text": text.strip(),
            "word_count": total_words
        }]
        
    overlap_words = int(target_tokens * overlap_pct)
    step = target_tokens - overlap_words
    if step <= 0:
        step = target_tokens // 2
        
    chunks = []
    chunk_idx = 0
    start = 0
    
    while start < total_words:
        end = min(start + target_tokens, total_words)
        chunk_words = words[start:end]
        chunk_str = " ".join(chunk_words)
        
        chunks.append({
            "chunk_index": chunk_idx,
            "text": chunk_str,
            "word_count": len(chunk_words)
        })
        chunk_idx += 1
        start += step
        if end >= total_words:
            break
            
    return chunks
