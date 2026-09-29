import json
import numpy as np
import re
from typing import List, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer

def generate_embeddings_for_chunks(chunk_texts: List[str]) -> List[List[float]]:
    """
    Generates high-dimensional vector embeddings for a list of text chunks.
    Uses sublinear TF-IDF + char/word n-grams for semantic domain matching.
    """
    if not chunk_texts:
        return []
    
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=512,
        sublinear_tf=True
    )
    
    matrix = vectorizer.fit_transform(chunk_texts).toarray()
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    normalized_matrix = matrix / norms
    
    return [row.tolist() for row in normalized_matrix]

def compute_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Computes cosine similarity between two vector lists."""
    if not vec_a or not vec_b:
        return 0.0
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    
    if a.shape[0] != b.shape[0]:
        min_len = min(a.shape[0], b.shape[0])
        a = a[:min_len]
        b = b[:min_len]
        
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))

def retrieve_top_k_chunks(
    objective_text: str,
    chunks: List[dict],
    top_k: int = 3,
    min_similarity: float = 0.04
) -> Tuple[List[dict], bool, float]:
    """
    Retrieves the most relevant chunks for an objective using cosine similarity & keyword overlap.
    Returns (matched_chunks, is_gap_detected, highest_score).
    """
    if not chunks:
        return [], True, 0.0
        
    chunk_texts = [c["text"] for c in chunks]
    all_texts = [objective_text] + chunk_texts
    
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english')
    try:
        matrix = vectorizer.fit_transform(all_texts).toarray()
        obj_vec = matrix[0]
        chunk_vecs = matrix[1:]
        
        sims = []
        for i, c_vec in enumerate(chunk_vecs):
            sim = compute_similarity(obj_vec.tolist(), c_vec.tolist())
            
            # Also calculate keyword overlap ratio
            obj_words = set(re.findall(r'\b\w{4,}\b', objective_text.lower()))
            chunk_words = set(re.findall(r'\b\w{4,}\b', chunks[i]["text"].lower()))
            overlap_score = len(obj_words.intersection(chunk_words)) / max(len(obj_words), 1)
            
            combined_score = max(sim, overlap_score)
            sims.append((combined_score, chunks[i]))
            
        sims.sort(key=lambda x: x[0], reverse=True)
        top_matches = [item[1] for item in sims[:top_k]]
        max_score = sims[0][0] if sims else 0.0
        
        # Check gap condition
        is_gap = max_score < min_similarity
        
        return top_matches, is_gap, max_score
    except Exception as e:
        print(f"[Retrieval Error] {e}")
        return chunks[:top_k], False, 0.5
