import re
import difflib
from typing import List, Dict, Any, Tuple
from .embeddings import compute_similarity, generate_embeddings_for_chunks

def run_all_guardrails(
    asset_type: str,
    content_json: Dict[str, Any],
    retrieved_chunks: List[Dict[str, Any]],
    requested_bloom_level: str = "Understand",
    all_unit_objectives_count: Dict[int, int] = None,
    objective_id: int = None
) -> List[Dict[str, Any]]:
    """
    Executes all 6 Automated Quality Guardrails specified in §5.
    Returns list of quality flag dicts (flag_type, severity, message, resolved_bool).
    """
    flags = []
    
    # 1. DUPLICATE / NEAR-IDENTICAL QUESTIONS
    if asset_type in ["quiz", "practice_easy", "practice_advanced"]:
        questions = content_json.get("questions", [])
        q_texts = [(q.get("question", "") or q.get("question_text", "") or q.get("prompt", "")) for q in questions if isinstance(q, dict)]
        if len(q_texts) > 1:
            for i in range(len(q_texts)):
                for j in range(i + 1, len(q_texts)):
                    if q_texts[i] and q_texts[j]:
                        seq_match = difflib.SequenceMatcher(None, q_texts[i].lower(), q_texts[j].lower()).ratio()
                        if seq_match > 0.85:
                            flags.append({
                                "flag_type": "duplicate_question",
                                "severity": "error",
                                "message": f"Question {i+1} and Question {j+1} are near-identical ({int(seq_match*100)}% similarity). Duplicate questions detected."
                            })
                        
    # 2. ANSWER LEAKAGE IN QUESTION STEM
    if asset_type in ["quiz", "practice_easy", "practice_advanced", "answer_key"]:
        questions = content_json.get("questions", [])
        for i, q in enumerate(questions):
            if isinstance(q, dict):
                q_stem = (q.get("question", "") or q.get("question_text", "") or q.get("prompt", "")).lower()
                correct_answer = str(q.get("correct_answer", "") or q.get("_correct_option", "")).strip().lower()
                options = q.get("options", {})
                
                # Check direct leakage of answer value in question text
                if correct_answer in options:
                    correct_val = str(options[correct_answer]).strip().lower()
                    if len(correct_val) > 4 and correct_val in q_stem:
                        flags.append({
                            "flag_type": "answer_leakage",
                            "severity": "error",
                            "message": f"Question {i+1} leaks the correct answer ('{options[correct_answer]}') directly within the question stem."
                        })
                elif len(correct_answer) > 4 and correct_answer in q_stem:
                    flags.append({
                        "flag_type": "answer_leakage",
                        "severity": "error",
                        "message": f"Question {i+1} stem contains the exact target answer string ('{correct_answer}')."
                    })

    # 3. ANSWER KEY MISMATCH
    if asset_type in ["quiz", "practice_easy", "practice_advanced", "answer_key"]:
        # Check quiz questions
        questions = content_json.get("questions", [])
        for i, q in enumerate(questions):
            if isinstance(q, dict):
                options = q.get("options", {})
                correct_key = str(q.get("correct_option_id") or q.get("correct_option") or q.get("_correct_option") or "").strip().upper()
                if not correct_key:
                    # Check if correct_answer is already one of the option keys
                    ca = str(q.get("correct_answer", "")).strip().upper()
                    if ca in ["A", "B", "C", "D"]:
                        correct_key = ca
                
                if options and isinstance(options, dict):
                    valid_keys = [k.upper() for k in options.keys()]
                    if not correct_key or correct_key not in valid_keys:
                        flags.append({
                            "flag_type": "answer_key_mismatch",
                            "severity": "error",
                            "message": f"Question {i+1} designates '{correct_key}' as answer key, but options only provide {list(options.keys())}."
                        })
                        
        # Check answer key entries
        entries = content_json.get("answer_entries", [])
        for i, ent in enumerate(entries):
            if isinstance(ent, dict):
                c_opt = str(ent.get("correct_option_id") or ent.get("correct_option") or ent.get("correct_answer") or "").strip().upper()
                if not c_opt or c_opt not in ["A", "B", "C", "D"]:
                    flags.append({
                        "flag_type": "answer_key_mismatch",
                        "severity": "error",
                        "message": f"Answer key entry {i+1} designates invalid option '{c_opt}'."
                    })

    # 4. UNSUPPORTED CLAIMS (Provenance Verification)
    if asset_type in ["explanation", "example", "revision_sheet"]:
        sentences = []
        body_text = content_json.get("text", "") or content_json.get("explanation", "") or content_json.get("summary", "")
        if body_text:
            sentences = [s.strip() for s in re.split(r'[.!?]+', body_text) if len(s.strip()) > 15]
            
        combined_source = " ".join([c.get("text", "").lower() for c in retrieved_chunks])
        
        unsupported_count = 0
        for sent in sentences[:6]: # check core statements
            sent_words = [w.lower() for w in re.findall(r'\b\w{4,}\b', sent)]
            if sent_words:
                matched_words = [w for w in sent_words if w in combined_source]
                ratio = len(matched_words) / len(sent_words)
                if ratio < 0.35: # very few key terms match the source chunk
                    unsupported_count += 1
                    
        if unsupported_count > 1 and len(retrieved_chunks) > 0:
            flags.append({
                "flag_type": "unsupported_claim",
                "severity": "warning",
                "message": f"Verification pass detected {unsupported_count} statement(s) with weak grounding back to retrieved source chunks."
            })

    # 5. MISSING OBJECTIVE COVERAGE
    if all_unit_objectives_count and objective_id:
        count = all_unit_objectives_count.get(objective_id, 0)
        if count == 0:
            flags.append({
                "flag_type": "missing_coverage",
                "severity": "warning",
                "message": f"Objective ID {objective_id} currently has 0 generated asset items."
            })
            
    # 6. EXTREME DIFFICULTY MISMATCH
    if asset_type in ["practice_easy", "practice_advanced", "quiz"]:
        bloom_lower = (requested_bloom_level or "").lower()
        is_advanced_asset = asset_type == "practice_advanced"
        questions = content_json.get("questions", [])
        
        for i, q in enumerate(questions):
            q_text = (q.get("question", "") if isinstance(q, dict) else str(q)).lower()
            # Check cognitive triggers
            higher_order_triggers = ["analyze", "evaluate", "compare", "critique", "synthesize", "differentiate", "why would", "contrast", "justify"]
            lower_order_triggers = ["what is", "define", "name the", "which of the following is", "state", "list"]
            
            has_high = any(trig in q_text for trig in higher_order_triggers)
            has_low = any(trig in q_text for trig in lower_order_triggers)
            
            if is_advanced_asset and has_low and not has_high:
                flags.append({
                    "flag_type": "difficulty_mismatch",
                    "severity": "warning",
                    "message": f"Item {i+1} in Advanced Practice uses basic recall phrasing ('{q_text[:35]}...') instead of higher-order cognitive analysis."
                })
            elif not is_advanced_asset and bloom_lower in ["remember", "understand"] and has_high:
                flags.append({
                    "flag_type": "difficulty_mismatch",
                    "severity": "info",
                    "message": f"Item {i+1} demands higher-order synthesis beyond the requested '{requested_bloom_level}' Bloom target."
                })
                
    return flags
