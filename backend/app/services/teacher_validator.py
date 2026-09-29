import re
import json
import difflib
import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from ..models import ValidationFlag, Source, SourceVersion, Chunk, Unit, Objective, Glossary, AssetVersion
from ..services.guardrails import run_all_guardrails
from .gemini_service import call_gemini_json

BLOOM_MEASURABLE_VERBS = {
    "Remember": ["Define", "Identify", "List", "Name", "Recall", "Recognize", "State"],
    "Understand": ["Describe", "Explain", "Summarize", "Interpret", "Classify", "Compare", "Paraphrase"],
    "Apply": ["Apply", "Calculate", "Demonstrate", "Solve", "Implement", "Use", "Illustrate"],
    "Analyze": ["Analyze", "Differentiate", "Examine", "Deconstruct", "Distinguish", "Investigate"],
    "Evaluate": ["Assess", "Evaluate", "Judge", "Critique", "Justify", "Determine"],
    "Create": ["Design", "Construct", "Formulate", "Develop", "Generate", "Synthesize"]
}

VAGUE_VERBS = ["learn", "know", "study", "read", "understand chapter", "look at", "go through", "be familiar with"]

def validate_learning_objective(
    text: str,
    target_level: Optional[str] = "High School",
    bloom_level: Optional[str] = "Understand",
    existing_objectives: Optional[List[str]] = None,
    unit_id: Optional[int] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Validates a teacher-submitted learning objective.
    Checks:
    - Vague/non-measurable action verbs
    - Typos / incomplete phrases
    - Contradictions / duplication with existing unit objectives
    """
    text_clean = text.strip()
    if not text_clean:
        return {"is_flagged": False, "issues": []}

    existing_objs = existing_objectives or []
    issues = []

    # 1. Quick check for duplication
    for ex in existing_objs:
        if ex and ex.strip().lower() == text_clean.lower():
            reason = "This objective is an exact duplicate of an existing objective defined for this unit."
            issues.append({
                "original": text_clean,
                "suggested": f"Differentiate {text_clean} from related concepts",
                "reason": reason
            })
            break

    # 2. Check for vague or non-measurable verbs
    words = text_clean.split()
    first_two = " ".join(words[:2]).lower() if len(words) >= 2 else words[0].lower()
    for vague in VAGUE_VERBS:
        if text_clean.lower().startswith(vague) or f" {vague} " in f" {text_clean.lower()} ":
            recommended_verb = BLOOM_MEASURABLE_VERBS.get(bloom_level, ["Explain"])[0]
            # Replace vague verb with measurable verb
            suggested = re.sub(r'^(to\s+)?(learn(\s+about)?|study|know|read|look\s+at)\s+', f'{recommended_verb} ', text_clean, flags=re.IGNORECASE)
            if suggested == text_clean:
                suggested = f"{recommended_verb} the core mechanisms of {text_clean}"
            
            issues.append({
                "original": text_clean,
                "suggested": suggested.strip().capitalize(),
                "reason": "This objective uses passive/vague wording — consider specifying what students should be able to do."
            })
            break

    # 3. If no simple heuristic caught it or if short/typo, run fast LLM check
    if not issues:
        try:
            prompt = f"""You are an expert pedagogy auditor for K-12/higher-ed curricula.
Analyze this submitted learning objective:
Objective: "{text_clean}"
Target Bloom's Taxonomy Level: {bloom_level}
Target Grade Level: {target_level}
Other objectives in this unit: {json.dumps(existing_objs)}

Audit for:
1. Is it clear, specific, and measurable (starts with an active Bloom's verb)?
2. Are there obvious typos or grammatical fragments (e.g. "energ", "photosynthesys")?
3. Does it contradict or unnecessarily duplicate another objective?

Return strictly JSON:
{{
  "is_flagged": true or false,
  "reason": "Clear one-line reason (under 120 chars) if flagged, else empty string",
  "suggested_value": "Suggested clarified/corrected objective if flagged, else empty string"
}}"""
            data = call_gemini_json(prompt, system_instruction="Output strictly JSON.")
            if data and data.get("is_flagged") and data.get("reason"):
                issues.append({
                    "original": text_clean,
                    "suggested": data.get("suggested_value") or text_clean,
                    "reason": data.get("reason")
                })
        except Exception as e:
            # Fallback gracefully
            pass

    # Save validation flags to DB if db session provided
    flag_records = []
    if db and issues:
        for iss in issues:
            flag = ValidationFlag(
                target_type="objective",
                target_id=str(unit_id) if unit_id else None,
                original_value=iss["original"],
                suggested_value=iss.get("suggested"),
                reason=iss["reason"],
                resolution="unresolved"
            )
            db.add(flag)
            db.commit()
            db.refresh(flag)
            flag_records.append({
                "flag_id": flag.id,
                "original": flag.original_value,
                "suggested": flag.suggested_value,
                "reason": flag.reason
            })

    return {
        "is_flagged": len(issues) > 0,
        "issues": flag_records if flag_records else issues
    }


def validate_ocr_correction(
    original_ocr_text: str,
    teacher_text: str,
    page_id: Optional[int] = None,
    page_number: Optional[int] = 1,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Validates teacher's OCR correction by comparing typed text against raw OCR token stream.
    If meaningful token discrepancies or drastic unintentional deletions occur, flags advisory suggestion.
    """
    orig = (original_ocr_text or "").strip()
    typed = (teacher_text or "").strip()

    if not orig or not typed:
        return {"is_flagged": False, "issues": []}

    orig_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', orig.lower()))
    typed_words = set(re.findall(r'\b[a-zA-Z]{3,}\b', typed.lower()))

    # Calculate token overlap similarity
    matcher = difflib.SequenceMatcher(None, orig.split(), typed.split())
    ratio = matcher.ratio()

    issues = []
    # If ratio is very low (< 0.25 on long text) or missing more than 70% of words
    if len(orig.split()) > 40 and len(typed.split()) < len(orig.split()) * 0.3:
        reason = "Independent re-check produced a different reading — page text appears significantly truncated compared to the scan."
        issues.append({
            "original": typed,
            "suggested": orig[:600] + ("..." if len(orig) > 600 else ""),
            "reason": reason
        })
    elif ratio < 0.4 and len(orig.split()) > 20:
        reason = "Independent re-check produced a different reading — please confirm which is correct."
        issues.append({
            "original": typed,
            "suggested": orig[:600] + ("..." if len(orig) > 600 else ""),
            "reason": reason
        })

    flag_records = []
    if db and issues:
        for iss in issues:
            flag = ValidationFlag(
                target_type="ocr_correction",
                target_id=str(page_id) if page_id else f"page_{page_number}",
                original_value=iss["original"],
                suggested_value=iss.get("suggested"),
                reason=iss["reason"],
                resolution="unresolved"
            )
            db.add(flag)
            db.commit()
            db.refresh(flag)
            flag_records.append({
                "flag_id": flag.id,
                "original": flag.original_value,
                "suggested": flag.suggested_value,
                "reason": flag.reason
            })

    return {
        "is_flagged": len(issues) > 0,
        "issues": flag_records if flag_records else issues
    }


def validate_glossary_term(
    term: str,
    canonical_wording: str,
    source_chunks: List[str],
    glossary_id: Optional[int] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Validates a canonical glossary term against the unit's source chunks.
    Fast rule-based / regex match against source material.
    """
    term_clean = term.strip()
    if not term_clean or not source_chunks:
        return {"is_flagged": False, "issues": []}

    combined_source = " ".join(source_chunks)

    # 1. Exact case-insensitive match
    pattern = r'\b' + re.escape(term_clean) + r'\b'
    if re.search(pattern, combined_source, re.IGNORECASE):
        # Exact match or case match found
        # Check if casing differs from source
        matches = re.findall(pattern, combined_source, re.IGNORECASE)
        if matches and matches[0] != term_clean:
            # Subtle casing difference
            source_casing = matches[0]
            if source_casing.lower() == term_clean.lower() and source_casing != term_clean:
                # Advisory suggestion
                pass
        return {"is_flagged": False, "issues": []}

    # 2. Term does NOT appear in source chunks. Search for closest matching terms or phrases in source.
    words_in_source = list(set(re.findall(r'\b[a-zA-Z]{3,}\b', combined_source)))
    close_words = difflib.get_close_matches(term_clean, words_in_source, n=2, cutoff=0.7)

    suggested = close_words[0] if close_words else None

    # Search for multi-word phrases if term is multiple words
    if not suggested and len(term_clean.split()) > 1:
        # Search sentences containing first or second word
        first_word = term_clean.split()[0]
        for chunk in source_chunks:
            match = re.search(r'\b(' + re.escape(first_word) + r'\s+[A-Za-z0-9_-]+(\s+[A-Za-z0-9_-]+)?)\b', chunk, re.IGNORECASE)
            if match:
                suggested = match.group(1)
                break

    reason = f"This doesn't match how the term appears in your source material."
    issues = [{
        "original": term_clean,
        "suggested": suggested or term_clean,
        "reason": reason
    }]

    flag_records = []
    if db and issues:
        for iss in issues:
            flag = ValidationFlag(
                target_type="glossary_term",
                target_id=str(glossary_id) if glossary_id else None,
                original_value=iss["original"],
                suggested_value=iss.get("suggested"),
                reason=iss["reason"],
                resolution="unresolved"
            )
            db.add(flag)
            db.commit()
            db.refresh(flag)
            flag_records.append({
                "flag_id": flag.id,
                "original": flag.original_value,
                "suggested": flag.suggested_value,
                "reason": flag.reason
            })

    return {
        "is_flagged": len(issues) > 0,
        "issues": flag_records if flag_records else issues
    }


def validate_asset_edit(
    asset_type: str,
    content_json: Dict[str, Any],
    source_chunks: List[str],
    objectives: List[str],
    version_id: Optional[int] = None,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Validates manual asset edits (Edit Raw JSON / inline editor) by re-running
    guardrail checks and grounding checks.
    """
    issues = []
    
    # 1. Structural / Answer Key Consistency for Quizzes
    if asset_type in ["quiz", "practice_easy", "practice_advanced"]:
        questions = content_json.get("questions", [])
        for idx, q in enumerate(questions):
            q_num = idx + 1
            opts = q.get("options", {})
            corr = str(q.get("correct_answer") or q.get("correct_option") or "").strip().upper()
            
            if not opts or len(opts) < 2:
                issues.append({
                    "original": f"Question {q_num}: Only {len(opts)} option(s) provided",
                    "suggested": "Ensure 4 options (A, B, C, D) are defined",
                    "reason": f"Question {q_num} has fewer than 2 selectable answer options."
                })
            elif corr not in opts and corr not in ["A", "B", "C", "D"]:
                issues.append({
                    "original": f"Question {q_num} Correct Answer: '{corr}'",
                    "suggested": f"A (Options: {', '.join(opts.keys())})",
                    "reason": f"Question {q_num} has an invalid or missing correct answer key matching its options."
                })

    # 2. Run existing guardrails
    try:
        flags = run_all_guardrails(
            content=content_json,
            source_chunks=source_chunks,
            objectives=objectives,
            source_text=" ".join(source_chunks)
        )
        for f in flags:
            if f.get("severity") in ["error", "warning"]:
                issues.append({
                    "original": f.get("flag_type", "Quality Flag"),
                    "suggested": f.get("evidence", "Review text to ensure grounding against source chunks"),
                    "reason": f.get("message", "Potential grounding contradiction or curriculum guideline mismatch introduced.")
                })
    except Exception as e:
        pass

    flag_records = []
    if db and issues:
        for iss in issues:
            flag = ValidationFlag(
                target_type="asset_edit",
                target_id=str(version_id) if version_id else None,
                original_value=str(iss["original"])[:200],
                suggested_value=str(iss.get("suggested"))[:200],
                reason=str(iss["reason"])[:200],
                resolution="unresolved"
            )
            db.add(flag)
            db.commit()
            db.refresh(flag)
            flag_records.append({
                "flag_id": flag.id,
                "original": flag.original_value,
                "suggested": flag.suggested_value,
                "reason": flag.reason
            })

    return {
        "is_flagged": len(issues) > 0,
        "issues": flag_records if flag_records else issues
    }
