import re
from typing import List, Dict, Any, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from .embeddings import compute_similarity
from .gemini_service import call_gemini_json

OBJECTIVE_STOP_WORDS = {
    "explain", "describe", "understand", "learn", "study", "know", "identify",
    "analyze", "evaluate", "compare", "contrast", "discuss", "define", "outline",
    "overview", "concept", "concepts", "process", "principles", "introduction",
    "fundamentals", "function", "functions", "role", "roles", "importance",
    "mechanism", "mechanisms", "what", "which", "when", "where", "with", "from",
    "that", "this", "these", "those", "have", "been", "using", "uses", "used"
}

def check_objective_source_coverage(
    objective_text: str,
    chunks: List[Dict[str, Any]],
    threshold: float = 0.55
) -> Dict[str, Any]:
    """
    Computes embedding & lexical semantic coverage of an objective against all source chunks.
    If best match confidence score is below threshold, generates a note on what the source
    does appear to cover instead.
    """
    clean_obj = (objective_text or "").strip()
    threshold_percent = int(round(threshold * 100))

    if not clean_obj or not chunks:
        return {
            "is_covered": False,
            "best_match_score": 0,
            "threshold": threshold_percent,
            "source_coverage_note": "No source material available to verify this objective.",
            "objective_text": clean_obj
        }

    chunk_texts = [c.get("text", "") for c in chunks]
    all_texts = [clean_obj] + chunk_texts

    # 1. Compute cosine similarity with TF-IDF 1-2 ngrams
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english')
    try:
        matrix = vectorizer.fit_transform(all_texts).toarray()
        obj_vec = matrix[0]
        chunk_vecs = matrix[1:]
        sims = [compute_similarity(obj_vec.tolist(), cv.tolist()) for cv in chunk_vecs]
        raw_max_sim = max(sims) if sims else 0.0
    except Exception:
        sims = [0.1] * len(chunk_texts)
        raw_max_sim = 0.1

    # 2. Informative keyword & domain term coverage
    obj_words = [w for w in re.findall(r'\b[a-zA-Z]{4,}\b', clean_obj.lower()) if w not in OBJECTIVE_STOP_WORDS]
    combined_source = " ".join(chunk_texts).lower()

    if obj_words:
        matched_words = [w for w in obj_words if re.search(r'\b' + re.escape(w) + r'\b', combined_source)]
        term_ratio = len(matched_words) / len(obj_words)
    else:
        term_ratio = 1.0

    # Collect top matching chunks for context
    indexed_sims = sorted(enumerate(sims), key=lambda x: x[1], reverse=True)
    top_excerpts = [chunk_texts[idx][:400] for idx, _ in indexed_sims[:4]]
    excerpts_text = "\n---\n".join(top_excerpts)

    # 3. LLM Curriculum Audit Check
    prompt = f"""You are an expert curriculum auditor.
Determine whether the uploaded source excerpts provide adequate factual coverage for the learning objective.

Learning Objective: "{clean_obj}"

Source Excerpts:
{excerpts_text}

Evaluate:
1. "confidence_score": integer from 0 to 100 representing how well the source excerpts directly cover this objective. (If a core concept or entity mentioned in the objective is absent from the source, score must be below 50).
2. "is_covered": boolean (true if confidence_score >= {threshold_percent}, false otherwise).
3. "coverage_note": if is_covered is false, 1-2 concise sentences stating what the source appears to cover instead (e.g. "Your source appears to cover the OSI model, but does not define a distinct 'semantic layer'"). If true, empty string.

Output strictly JSON:
{{
  "confidence_score": 85,
  "is_covered": true,
  "coverage_note": ""
}}"""

    llm_res = call_gemini_json(prompt, system_instruction="You are an expert curriculum auditor. Output strictly JSON.")
    if llm_res and isinstance(llm_res, dict) and "confidence_score" in llm_res:
        conf = int(llm_res.get("confidence_score", 0))
        is_cov = bool(llm_res.get("is_covered", conf >= threshold_percent))
        note = str(llm_res.get("coverage_note", "")).strip() if not is_cov else ""
        return {
            "is_covered": is_cov,
            "best_match_score": conf,
            "threshold": threshold_percent,
            "source_coverage_note": note,
            "objective_text": clean_obj
        }

    # Fallback to blended score if LLM is unavailable
    final_score = (raw_max_sim * 0.55) + (term_ratio * 0.45)
    score_percent = int(round(final_score * 100))
    is_cov = score_percent >= threshold_percent
    fallback_note = "" if is_cov else f"Your source material touches upon related topics, but does not provide sufficient authoritative coverage for '{clean_obj}'."

    return {
        "is_covered": is_cov,
        "best_match_score": score_percent,
        "threshold": threshold_percent,
        "source_coverage_note": fallback_note,
        "objective_text": clean_obj
    }
