import json
import random
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    User, Classroom, Enrollment, Unit, Asset, AssetVersion,
    Assignment, Submission, Objective, Source, SourceVersion, Chunk, Glossary,
    StudentRequest, RequestResponse
)
from ..schemas import (
    JoinClassroomRequest, SubmitAssessmentRequest, SelfPacedTestGenerateRequest,
    StudentRequestCreate, DiagnosticPoolRequest, DiagnosticEvaluateRequest
)
from ..auth import student_required, student_required_flexible
from ..services.pdf_exporter import generate_learning_pack_pdf
from ..services.rag_engine import generate_formative_quiz, generate_diagnostic_pool

router = APIRouter(prefix="/api/student", tags=["Student Portal"])

@router.get("/classrooms")
def get_student_classrooms(db: Session = Depends(get_db), current_student: User = Depends(student_required)):
    enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_student.id).all()
    res = []
    for e in enrollments:
        classroom = db.query(Classroom).filter(Classroom.id == e.classroom_id).first()
        teacher = db.query(User).filter(User.id == classroom.teacher_id).first() if classroom else None
        res.append({
            "classroom_id": classroom.id if classroom else None,
            "name": classroom.name if classroom else "",
            "subject": classroom.subject if classroom else "",
            "teacher_name": teacher.name if teacher else "Instructor",
            "joined_at": e.joined_at,
            "status": e.status or "approved"
        })
    return res

@router.post("/classrooms/join")
def join_classroom_by_code(data: JoinClassroomRequest, db: Session = Depends(get_db), current_student: User = Depends(student_required)):
    code = data.join_code.strip().upper()
    classroom = db.query(Classroom).filter(Classroom.join_code == code).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid join code. Classroom not found.")
        
    teacher = db.query(User).filter(User.id == classroom.teacher_id).first()
    teacher_name = teacher.name if teacher else "Instructor"

    existing = db.query(Enrollment).filter(
        Enrollment.student_id == current_student.id,
        Enrollment.classroom_id == classroom.id
    ).first()
    
    if existing:
        if existing.status == "approved":
            return {
                "message": f"You are already an enrolled member of {classroom.name}.",
                "classroom_id": classroom.id,
                "status": "approved"
            }
        elif existing.status == "pending":
            return {
                "message": f"Join permission request for '{classroom.name}' has already been submitted to {teacher_name} and is awaiting approval.",
                "classroom_id": classroom.id,
                "status": "pending"
            }
        elif existing.status == "rejected":
            existing.status = "pending"
            existing.joined_at = datetime.utcnow()
            db.commit()
            return {
                "message": f"Join permission request for '{classroom.name}' resubmitted to {teacher_name} for approval!",
                "classroom_id": classroom.id,
                "status": "pending"
            }
        
    enrollment = Enrollment(student_id=current_student.id, classroom_id=classroom.id, status="pending")
    db.add(enrollment)
    db.commit()
    
    return {
        "message": f"Permission requested! Your request to join '{classroom.name}' was sent to {teacher_name}. Access will be granted once approved.",
        "classroom_id": classroom.id,
        "status": "pending"
    }

@router.get("/materials")
def get_approved_materials(classroom_id: int, db: Session = Depends(get_db), current_student: User = Depends(student_required)):
    """
    CRITICAL SECURITY CHECK (§3.3 & §8):
    Student can ONLY access approved content assigned to their enrolled classroom.
    The study pack contains explanation, worked examples, revision rules, and glossary.
    Assigned test questions are excluded from the pack and served via Formative Assessments.
    """
    # Verify enrollment is active and approved by instructor
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == current_student.id,
        Enrollment.classroom_id == classroom_id,
        Enrollment.status == "approved"
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="You are not enrolled or pending teacher approval for this classroom.")
        
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found.")

    # Get all active assignments for this classroom
    classroom_assignments = db.query(Assignment).filter(
        Assignment.classroom_id == classroom_id,
        Assignment.status == "active"
    ).all()
    
    assigned_unit_ids = set()
    for a in classroom_assignments:
        ver = db.query(AssetVersion).filter(AssetVersion.id == a.asset_version_id).first()
        if ver:
            asset = db.query(Asset).filter(Asset.id == ver.asset_id).first()
            if asset:
                assigned_unit_ids.add(asset.unit_id)

    materials = []
    if assigned_unit_ids:
        units = db.query(Unit).filter(Unit.id.in_(list(assigned_unit_ids))).all()
        for u in units:
            # Query approved study pack assets for this unit (explanation, example, revision_sheet)
            exp_ver = db.query(AssetVersion).join(Asset).filter(
                Asset.unit_id == u.id,
                Asset.type == "explanation",
                AssetVersion.status == "approved"
            ).order_by(AssetVersion.version_no.desc()).first()

            ex_ver = db.query(AssetVersion).join(Asset).filter(
                Asset.unit_id == u.id,
                Asset.type == "example",
                AssetVersion.status == "approved"
            ).order_by(AssetVersion.version_no.desc()).first()

            rev_ver = db.query(AssetVersion).join(Asset).filter(
                Asset.unit_id == u.id,
                Asset.type == "revision_sheet",
                AssetVersion.status == "approved"
            ).order_by(AssetVersion.version_no.desc()).first()

            all_vers = [v for v in [exp_ver, ex_ver, rev_ver] if v]
            if not all_vers:
                continue

            exp_json = json.loads(exp_ver.content_json) if exp_ver else {}
            ex_json = json.loads(ex_ver.content_json) if ex_ver else {}
            rev_json = json.loads(rev_ver.content_json) if rev_ver else {}

            glossary_list = [{"id": g.id, "term": g.term, "canonical_wording": g.canonical_wording} for g in u.glossary_terms]
            objectives_list = [{"id": o.id, "text": o.text} for o in u.objectives]

            # Collect citations
            all_citations = []
            for j in [exp_json, ex_json, rev_json]:
                if "chunk_citations" in j and isinstance(j["chunk_citations"], list):
                    all_citations.extend(j["chunk_citations"])
            all_citations = list(dict.fromkeys(all_citations))

            # Build Full Consolidated Study Pack Content (No test questions leaked into pack)
            full_content = {
                "title": f"Complete Study Pack: {u.title}",
                "unit_title": u.title,
                "topic": u.title,
                "explanation": exp_json.get("explanation", ""),
                "short_summary_points": exp_json.get("short_summary_points", []),
                "key_points": exp_json.get("key_points", []),
                "steps": ex_json.get("steps", []),
                "problem_statement": ex_json.get("problem_statement", ""),
                "method_explanation": ex_json.get("method_explanation", ""),
                "key_takeaways": rev_json.get("key_takeaways", []),
                "rapid_memory_triggers": rev_json.get("rapid_memory_triggers", rev_json.get("quick_recall_bullets", [])),
                "questions": [], # Test questions are in Formative Assessments
                "glossary": glossary_list,
                "chunk_citations": all_citations,
                "explanation_pack": exp_json if exp_ver else None,
                "example_pack": ex_json if ex_ver else None,
                "revision_pack": rev_json if rev_ver else None,
            }

            max_ver_no = max([v.version_no for v in all_vers])
            latest_approved_at = max([v.approved_at for v in all_vers if v.approved_at] or [datetime.utcnow()])

            materials.append({
                "unit_id": u.id,
                "version_id": all_vers[0].id,
                "unit_title": u.title,
                "classroom_id": classroom.id,
                "classroom_name": classroom.name,
                "subject": classroom.subject,
                "domain": classroom.subject,
                "objective_text": u.objectives[0].text if u.objectives else "Complete Curriculum Pack",
                "type": "full_pack",
                "version_no": max_ver_no,
                "approved_at": latest_approved_at,
                "content": full_content,
                "components": {
                    "has_explanation": exp_ver is not None,
                    "has_example": ex_ver is not None,
                    "has_revision": rev_ver is not None,
                    "has_glossary": len(glossary_list) > 0
                }
            })
                    
    return materials

@router.get("/assignments")
def get_assigned_assessments(classroom_id: int, db: Session = Depends(get_db), current_student: User = Depends(student_required)):
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == current_student.id,
        Enrollment.classroom_id == classroom_id,
        Enrollment.status == "approved"
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="You are not enrolled or pending teacher approval for this classroom.")
        
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found.")
        
    assignments = db.query(Assignment).filter(
        Assignment.classroom_id == classroom_id,
        Assignment.status == "active"
    ).all()
    
    # Group all assessments by Unit
    unit_map = {}
    
    for a in assignments:
        ver = db.query(AssetVersion).filter(AssetVersion.id == a.asset_version_id, AssetVersion.status == "approved").first()
        if not ver:
            continue
            
        asset = db.query(Asset).filter(Asset.id == ver.asset_id).first()
        if not asset or asset.type not in ["quiz", "practice_easy", "practice_advanced"]:
            continue
            
        unit = db.query(Unit).filter(Unit.id == asset.unit_id).first() if asset else None
        if not unit:
            continue
            
        obj = db.query(Objective).filter(Objective.id == asset.objective_id).first() if asset.objective_id else None
        
        try:
            raw_content = json.loads(ver.content_json)
        except:
            raw_content = {}
            
        asset_questions = raw_content.get("questions", [])
        if not asset_questions:
            continue
            
        if unit.id not in unit_map:
            unit_map[unit.id] = {
                "unit": unit,
                "primary_assignment": a,
                "assignments": [],
                "questions": [],
                "all_assignment_ids": []
            }
            
        unit_map[unit.id]["assignments"].append(a)
        unit_map[unit.id]["all_assignment_ids"].append(a.id)
        
        tier_label = "Formative Quiz" if asset.type == "quiz" else ("Practice (Easy)" if asset.type == "practice_easy" else "Practice (Advanced)")
        
        for idx, q in enumerate(asset_questions):
            q_id = f"q_{asset.id}_{q.get('id', idx+1)}"
            unit_map[unit.id]["questions"].append({
                "id": q_id,
                "raw_id": q.get("id", idx+1),
                "asset_id": asset.id,
                "asset_type": asset.type,
                "tier_label": tier_label,
                "objective_title": obj.text if obj else "General Concept",
                "question": q.get("question") or q.get("question_text", f"Assessment Question {idx+1}"),
                "options": q.get("options", {}),
                "bloom_level": q.get("bloom_level")
            })

    res = []
    for unit_id, udata in unit_map.items():
        unit = udata["unit"]
        primary_assign = udata["primary_assignment"]
        all_a_ids = udata["all_assignment_ids"]
        
        # Check submissions across this unit's assignments
        submissions = db.query(Submission).filter(
            Submission.student_id == current_student.id,
            Submission.assignment_id.in_(all_a_ids)
        ).order_by(Submission.submitted_at.desc()).all()
        
        attempts_used = len(submissions)
        max_attempts = primary_assign.max_attempts if primary_assign.max_attempts is not None else 1
        attempts_remaining = max(0, max_attempts - attempts_used)
        can_attempt = (max_attempts > 0) and (attempts_remaining > 0)
        latest_sub = submissions[0] if submissions else None
        
        res.append({
            "assignment_id": primary_assign.id,
            "unit_id": unit.id,
            "unit_title": unit.title,
            "asset_type": "unit_assessment_set",
            "title": f"Assigned Test: {unit.title}",
            "classroom_id": classroom.id,
            "classroom_name": classroom.name,
            "subject": classroom.subject,
            "domain": classroom.subject,
            "due_date": primary_assign.due_date,
            "max_attempts": max_attempts,
            "time_limit_minutes": primary_assign.time_limit_minutes or 15,
            "attempts_used": attempts_used,
            "attempts_remaining": attempts_remaining,
            "can_attempt": can_attempt,
            "questions": udata["questions"],
            "total_questions": len(udata["questions"]),
            "latest_submission": {
                "score": latest_sub.score,
                "objective_breakdown": json.loads(latest_sub.objective_breakdown_json) if latest_sub and latest_sub.objective_breakdown_json else {},
                "submitted_at": latest_sub.submitted_at
            } if latest_sub else None
        })
        
    return res

# ----------------------------------------------------------------------
# AI-POWERED SELF-PACED PRACTICE GENERATOR (GEMINI AI)
# ----------------------------------------------------------------------
@router.get("/self-paced/topics")
def get_self_paced_topics(db: Session = Depends(get_db), current_student: User = Depends(student_required)):
    """Returns available topics from all approved packs in enrolled classrooms."""
    enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_student.id, Enrollment.status == "approved").all()
    classroom_ids = [e.classroom_id for e in enrollments]
    if not classroom_ids:
        return []
    
    assignments = db.query(Assignment).filter(
        Assignment.classroom_id.in_(classroom_ids),
        Assignment.status == "active"
    ).all()
    
    unit_ids = set()
    for a in assignments:
        ver = db.query(AssetVersion).filter(AssetVersion.id == a.asset_version_id).first()
        if ver:
            asset = db.query(Asset).filter(Asset.id == ver.asset_id).first()
            if asset:
                unit_ids.add(asset.unit_id)
                
    units = db.query(Unit).filter(Unit.id.in_(list(unit_ids))).all()
    
    topics = []
    for u in units:
        objs = db.query(Objective).filter(Objective.unit_id == u.id).all()
        classrooms = db.query(Classroom).filter(Classroom.id.in_(classroom_ids)).all()
        c_names = [c.name for c in classrooms]
        subjects = list(set([c.subject for c in classrooms if c.subject]))
        
        topics.append({
            "unit_id": u.id,
            "title": u.title,
            "topic": u.title,
            "subject": subjects[0] if subjects else "General",
            "objectives": [{"id": o.id, "text": o.text, "bloom_level": o.bloom_level} for o in objs],
            "classrooms": c_names
        })
    return topics

@router.post("/self-paced/generate")
def generate_self_paced_test(
    data: SelfPacedTestGenerateRequest,
    db: Session = Depends(get_db),
    current_student: User = Depends(student_required)
):
    """
    Generates dynamic on-demand self-paced practice questions using Gemini AI
    strictly grounded in the selected assigned pack topic's source material.
    """
    enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_student.id, Enrollment.status == "approved").all()
    classroom_ids = [e.classroom_id for e in enrollments]
    if not classroom_ids:
        raise HTTPException(status_code=403, detail="You must be enrolled in at least one classroom to practice.")
        
    unit = None
    if data.unit_id:
        unit = db.query(Unit).filter(Unit.id == data.unit_id).first()
    elif data.topic:
        unit = db.query(Unit).filter(Unit.title.ilike(f"%{data.topic.strip()}%")).first()
        
    if not unit:
        # Fallback to the first available unit in student's enrolled classrooms
        assignments = db.query(Assignment).filter(Assignment.classroom_id.in_(classroom_ids), Assignment.status == "active").all()
        for a in assignments:
            ver = db.query(AssetVersion).filter(AssetVersion.id == a.asset_version_id).first()
            if ver:
                asset = db.query(Asset).filter(Asset.id == ver.asset_id).first()
                if asset:
                    unit = db.query(Unit).filter(Unit.id == asset.unit_id).first()
                    if unit:
                        break
                        
    if not unit:
        raise HTTPException(status_code=404, detail="No assigned pack topic found for self-paced test.")
        
    # Retrieve unit source chunks
    source = db.query(Source).filter(Source.id == unit.source_id).first()
    latest_source_version = db.query(SourceVersion).filter(SourceVersion.source_id == source.id).order_by(SourceVersion.version_no.desc()).first() if source else None
    
    chunks = []
    if latest_source_version:
        chunk_recs = db.query(Chunk).filter(Chunk.source_version_id == latest_source_version.id).order_by(Chunk.chunk_index.asc()).all()
        chunks = [{"id": c.id, "chunk_index": c.chunk_index, "text": c.text} for c in chunk_recs]
        
    objectives = db.query(Objective).filter(Objective.unit_id == unit.id).all()
    obj_texts = [o.text for o in objectives] if objectives else [f"Mastery of {unit.title} concepts and mechanisms"]
    primary_obj = " · ".join(obj_texts[:2])
    
    num_q = max(1, min(20, int(data.num_questions or 5)))
    difficulty = data.difficulty or "Medium"
    bloom = data.bloom_level or "Apply"
    
    # Retrieve unit glossary
    glossary_recs = db.query(Glossary).filter(Glossary.unit_id == unit.id).all()
    glossary = [{"term": g.term, "canonical_wording": g.canonical_wording} for g in glossary_recs]

    # Generate fresh self-paced assessment set using Gemini AI & RAG Engine
    result = generate_formative_quiz(
        objective_text=primary_obj,
        chunks=chunks,
        glossary=glossary,
        bloom_level=bloom,
        num_questions=num_q,
        difficulty_mode=difficulty
    )
    
    # Format questions cleanly for interactive client testing with option shuffling
    formatted_questions = []
    for idx, q in enumerate(result.get("questions", [])):
        raw_opts = q.get("options", {})
        raw_corr_id = str(q.get("correct_option_id") or q.get("correct_option") or "A").upper().strip()
        raw_corr_text = str(q.get("correct_answer") or q.get("_correct_answer_text") or raw_opts.get(raw_corr_id, "")).strip()

        if isinstance(raw_opts, dict) and len(raw_opts) >= 2:
            if not raw_corr_text and raw_corr_id in raw_opts:
                raw_corr_text = str(raw_opts[raw_corr_id]).strip()
            
            if raw_corr_id not in raw_opts:
                for k, v in raw_opts.items():
                    if str(v).strip().lower() == raw_corr_text.lower():
                        raw_corr_id = k
                        raw_corr_text = str(v).strip()
                        break
                else:
                    raw_corr_id = list(raw_opts.keys())[0]
                    raw_corr_text = str(raw_opts[raw_corr_id]).strip()

            opt_values = [str(v).strip() for v in raw_opts.values()]
            random.shuffle(opt_values)
            std_keys = ["A", "B", "C", "D"][:len(opt_values)]
            shuffled_options = {k: val for k, val in zip(std_keys, opt_values)}

            try:
                new_corr_idx = opt_values.index(raw_corr_text)
                new_corr_key = std_keys[new_corr_idx]
            except ValueError:
                new_corr_key = "A"
                shuffled_options["A"] = raw_corr_text
        else:
            shuffled_options = raw_opts
            new_corr_key = raw_corr_id

        formatted_questions.append({
            "id": f"sp_{unit.id}_{idx+1}",
            "question": q.get("question") or q.get("stem") or q.get("question_text", f"Question {idx+1}"),
            "options": shuffled_options,
            "correct_answer": new_corr_key,
            "correct_option": new_corr_key,
            "correct_option_id": new_corr_key,
            "correct_answer_text": raw_corr_text,
            "rationale": q.get("rationale") or q.get("explanation", ""),
            "difficulty_tier": q.get("difficulty_tier", difficulty),
            "bloom_level": q.get("bloom_level", bloom),
            "citation": q.get("source_citation") or (result.get("chunk_citations", ["Chunk #1"])[0])
        })
    
    return {
        "unit_id": unit.id,
        "topic": unit.title,
        "unit_title": unit.title,
        "difficulty": difficulty,
        "bloom_level": bloom,
        "total_questions": len(formatted_questions),
        "questions": formatted_questions,
        "chunk_citations": result.get("chunk_citations", []),
        "generated_by": "Gemini AI Engine (Self-Paced Mode)",
        "created_at": datetime.utcnow().isoformat()
    }


@router.post("/self-paced/diagnostic-pool")
def get_adaptive_diagnostic_pool(
    data: DiagnosticPoolRequest,
    db: Session = Depends(get_db),
    current_student: User = Depends(student_required)
):
    """
    Generates a calibrated multi-tier question pool (Easy, Medium, Hard)
    for Computer Adaptive Testing (CAT) dynamic diagnostic evaluation.
    """
    enrollments = db.query(Enrollment).filter(Enrollment.student_id == current_student.id, Enrollment.status == "approved").all()
    classroom_ids = [e.classroom_id for e in enrollments]
    if not classroom_ids:
        raise HTTPException(status_code=403, detail="You must be enrolled in at least one classroom to practice.")

    unit = None
    if data.unit_id:
        unit = db.query(Unit).filter(Unit.id == data.unit_id).first()
    elif data.topic:
        unit = db.query(Unit).filter(Unit.title.ilike(f"%{data.topic.strip()}%")).first()

    if not unit:
        assignments = db.query(Assignment).filter(Assignment.classroom_id.in_(classroom_ids), Assignment.status == "active").all()
        for a in assignments:
            ver = db.query(AssetVersion).filter(AssetVersion.id == a.asset_version_id).first()
            if ver:
                asset = db.query(Asset).filter(Asset.id == ver.asset_id).first()
                if asset:
                    unit = db.query(Unit).filter(Unit.id == asset.unit_id).first()
                    if unit:
                        break

    if not unit:
        raise HTTPException(status_code=404, detail="No assigned pack topic found for diagnostic test.")

    source = db.query(Source).filter(Source.id == unit.source_id).first()
    latest_source_version = db.query(SourceVersion).filter(SourceVersion.source_id == source.id).order_by(SourceVersion.version_no.desc()).first() if source else None

    chunks = []
    if latest_source_version:
        chunk_recs = db.query(Chunk).filter(Chunk.source_version_id == latest_source_version.id).order_by(Chunk.chunk_index.asc()).all()
        chunks = [{"id": c.id, "chunk_index": c.chunk_index, "text": c.text} for c in chunk_recs]

    objectives = db.query(Objective).filter(Objective.unit_id == unit.id).all()
    obj_texts = [o.text for o in objectives] if objectives else [f"Mastery of {unit.title} concepts and mechanisms"]
    primary_obj = " · ".join(obj_texts[:2])

    glossary_recs = db.query(Glossary).filter(Glossary.unit_id == unit.id).all()
    glossary = [{"term": g.term, "canonical_wording": g.canonical_wording} for g in glossary_recs]

    per_tier = data.questions_per_tier or 3
    result = generate_diagnostic_pool(
        objective_text=primary_obj,
        chunks=chunks,
        glossary=glossary,
        questions_per_tier=per_tier
    )

    return {
        "unit_id": unit.id,
        "topic": unit.title,
        "unit_title": unit.title,
        "questions_per_tier": result.get("questions_per_tier", per_tier),
        "total_pool_count": result.get("total_pool_count", 0),
        "pools": result.get("pools", {}),
        "all_questions": result.get("all_questions", []),
        "generated_by": "Gemini AI CAT Diagnostic Engine",
        "created_at": datetime.utcnow().isoformat()
    }


@router.post("/self-paced/diagnostic-evaluate")
def evaluate_adaptive_diagnostic(
    data: DiagnosticEvaluateRequest,
    db: Session = Depends(get_db),
    current_student: User = Depends(student_required)
):
    """
    Evaluates dynamic adaptive test answers, computing difficulty tier breakdown (Easy/Medium/Hard),
    identifying Strong Areas, Areas to Improve, and Areas to Build Strength.
    """
    history = data.answers_history or []
    if not history:
        raise HTTPException(status_code=400, detail="No answer history provided for evaluation.")

    easy_correct, easy_total = 0, 0
    med_correct, med_total = 0, 0
    hard_correct, hard_total = 0, 0

    topic_stats = {}  # topic -> { correct, total, wrong_stems: [], tiers: [] }

    for h in history:
        tier = str(h.get("difficulty_tier", "Medium")).strip().capitalize()
        is_corr = bool(h.get("is_correct", False))
        topic = str(h.get("concept_topic") or h.get("topic") or "General Core Concept").strip()

        if topic not in topic_stats:
            topic_stats[topic] = {"correct": 0, "total": 0, "wrong_stems": [], "tiers": set()}
        topic_stats[topic]["total"] += 1
        topic_stats[topic]["tiers"].add(tier)
        if is_corr:
            topic_stats[topic]["correct"] += 1
        else:
            stem = h.get("question_stem") or h.get("stem") or ""
            rationale = h.get("rationale") or ""
            topic_stats[topic]["wrong_stems"].append({
                "stem": stem,
                "selected": h.get("selected_option"),
                "correct": h.get("correct_option"),
                "rationale": rationale
            })

        if tier == "Easy":
            easy_total += 1
            if is_corr: easy_correct += 1
        elif tier == "Medium":
            med_total += 1
            if is_corr: med_correct += 1
        elif tier == "Hard":
            hard_total += 1
            if is_corr: hard_correct += 1

    easy_pct = round((easy_correct / max(1, easy_total)) * 100)
    med_pct = round((med_correct / max(1, med_total)) * 100)
    hard_pct = round((hard_correct / max(1, hard_total)) * 100)
    total_q = easy_total + med_total + hard_total
    total_corr = easy_correct + med_correct + hard_correct
    overall_pct = round((total_corr / max(1, total_q)) * 100)

    # Determine mastery level
    if hard_total > 0 and hard_pct >= 66 and med_pct >= 75 and easy_pct >= 80:
        level_key = "master"
        level_title = "Master / Expert"
        level_badge = "🏆 Master"
        level_desc = "Outstanding performance across all cognitive tiers. You have mastered core facts, practical scenarios, and complex edge-case evaluations."
    elif (hard_total > 0 and hard_pct >= 33 and med_pct >= 60) or (med_pct >= 80 and easy_pct >= 85):
        level_key = "advanced"
        level_title = "Advanced / Proficient"
        level_badge = "🚀 Advanced"
        level_desc = "Strong analytical grasp and reliable problem solving. You navigate intermediate and advanced challenges with consistent reasoning."
    elif med_pct >= 50 or easy_pct >= 75:
        level_key = "intermediate"
        level_title = "Intermediate / Competent"
        level_badge = "⚡ Intermediate"
        level_desc = "Solid conceptual foundation in core topics. You solve foundational and direct application questions well, but need more practice on multi-step and hard edge cases."
    else:
        level_key = "foundational"
        level_title = "Foundational / Beginner"
        level_badge = "🌱 Foundational"
        level_desc = "Building early mastery. Prioritize reviewing key definitions, textbook glossary terms, and step-by-step worked solutions in the study packs."

    strong_areas = []
    improve_areas = []
    build_areas = []

    for topic, stats in topic_stats.items():
        t_corr, t_tot = stats["correct"], stats["total"]
        pct = round((t_corr / max(1, t_tot)) * 100)
        tiers_list = list(stats["tiers"])

        if pct >= 75:
            strong_areas.append({
                "topic": topic,
                "score": f"{t_corr}/{t_tot}",
                "percent": pct,
                "tiers": tiers_list,
                "feedback": f"Strong conceptual confidence demonstrated ({pct}% accuracy)."
            })
        elif pct < 50:
            improve_areas.append({
                "topic": topic,
                "score": f"{t_corr}/{t_tot}",
                "percent": pct,
                "tiers": tiers_list,
                "mistakes": stats["wrong_stems"][:2],
                "feedback": f"Requires targeted review. {t_tot - t_corr} of {t_tot} questions were missed."
            })
        else:
            build_areas.append({
                "topic": topic,
                "score": f"{t_corr}/{t_tot}",
                "percent": pct,
                "tiers": tiers_list,
                "feedback": f"Partial mastery ({pct}% accuracy). Practice medium application scenarios to reinforce consistency."
            })

    # Ensure at least some constructive feedback if small sample
    if not strong_areas and overall_pct >= 50:
        strong_areas.append({
            "topic": data.unit_title or "Foundational Topic Knowledge",
            "score": f"{total_corr}/{total_q}",
            "percent": overall_pct,
            "tiers": ["Easy", "Medium"],
            "feedback": "Consistent foundational rule recall across multiple questions."
        })

    return {
        "unit_id": data.unit_id,
        "unit_title": data.unit_title or "Diagnostic Topic",
        "evaluated_at": datetime.utcnow().isoformat(),
        "overall_score": {
            "correct": total_corr,
            "total": total_q,
            "percent": overall_pct
        },
        "level": {
            "key": level_key,
            "title": level_title,
            "badge": level_badge,
            "description": level_desc
        },
        "tier_breakdown": {
            "easy": {"correct": easy_correct, "total": easy_total, "percent": easy_pct},
            "medium": {"correct": med_correct, "total": med_total, "percent": med_pct},
            "hard": {"correct": hard_correct, "total": hard_total, "percent": hard_pct}
        },
        "strong_areas": strong_areas,
        "improve_areas": improve_areas,
        "build_areas": build_areas,
        "recommendation": f"Focus upcoming practice on: {', '.join([a['topic'] for a in improve_areas[:2]]) if improve_areas else 'maintaining advanced mastery with hard challenge sets.'}"
    }



@router.post("/assignments/submit")
def submit_assessment(data: SubmitAssessmentRequest, db: Session = Depends(get_db), current_student: User = Depends(student_required)):
    assignment = db.query(Assignment).filter(Assignment.id == data.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    ver = db.query(AssetVersion).filter(AssetVersion.id == assignment.asset_version_id).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Asset version not found")
    asset = db.query(Asset).filter(Asset.id == ver.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    unit = db.query(Unit).filter(Unit.id == asset.unit_id).first()
    
    # Fetch all assessment assets and assignments in this unit for this classroom
    classroom_unit_assignments = db.query(Assignment).filter(
        Assignment.classroom_id == assignment.classroom_id
    ).all()
    
    all_unit_assign_ids = []
    unit_assets_map = {}
    
    for ca in classroom_unit_assignments:
        ca_ver = db.query(AssetVersion).filter(AssetVersion.id == ca.asset_version_id, AssetVersion.status == "approved").first()
        if not ca_ver:
            continue
        ca_asset = db.query(Asset).filter(Asset.id == ca_ver.asset_id).first()
        if ca_asset and unit and ca_asset.unit_id == unit.id and ca_asset.type in ["quiz", "practice_easy", "practice_advanced"]:
            all_unit_assign_ids.append(ca.id)
            obj = db.query(Objective).filter(Objective.id == ca_asset.objective_id).first() if ca_asset.objective_id else None
            unit_assets_map[ca_asset.id] = {
                "asset": ca_asset,
                "version": ca_ver,
                "objective": obj,
                "content": json.loads(ca_ver.content_json)
            }
            
    # Check attempts count across the unit assignments
    prev_subs = db.query(Submission).filter(
        Submission.student_id == current_student.id,
        Submission.assignment_id.in_(all_unit_assign_ids)
    ).count()
    if prev_subs >= (assignment.max_attempts or 1):
        raise HTTPException(status_code=400, detail="Maximum submission attempts reached for this assessment.")
        
    # Auto-score all unit questions against answer keys
    correct_count = 0
    total_count = 0
    obj_stats = {}
    question_evaluations = []
    
    for a_id, item in unit_assets_map.items():
        obj_name = item["objective"].text if item["objective"] else "General Knowledge"
        if obj_name not in obj_stats:
            obj_stats[obj_name] = {"correct": 0, "total": 0}
            
        questions = item["content"].get("questions", [])
        for idx, q in enumerate(questions):
            total_count += 1
            obj_stats[obj_name]["total"] += 1
            
            raw_id = q.get("id", idx + 1)
            full_q_id = f"q_{a_id}_{raw_id}"
            
            opts = q.get("options", {})
            corr_key = str(q.get("correct_option_id") or q.get("correct_option") or q.get("_correct_option") or "").strip().upper()
            corr_text = str(q.get("correct_answer") or q.get("correct_answer_text") or "").strip()
            
            if not corr_key and corr_text and isinstance(opts, dict):
                for ok, ov in opts.items():
                    if str(ov).strip().lower() == corr_text.lower():
                        corr_key = ok.strip().upper()
                        break
            if not corr_key:
                corr_key = "A"
                
            student_ans = str(data.answers.get(full_q_id, data.answers.get(str(raw_id), data.answers.get(f"q{idx+1}", "")))).strip().upper()
            
            is_correct = False
            if student_ans:
                if student_ans == corr_key:
                    is_correct = True
                elif student_ans in opts and str(opts[student_ans]).strip().lower() == corr_text.lower():
                    is_correct = True
                elif corr_key in opts and student_ans.lower() == str(opts[corr_key]).strip().lower():
                    is_correct = True
                    
            if is_correct:
                correct_count += 1
                obj_stats[obj_name]["correct"] += 1
                
            question_evaluations.append({
                "id": full_q_id,
                "question": q.get("question") or q.get("question_text", f"Question {idx+1}"),
                "options": opts,
                "student_answer": student_ans,
                "correct_option": corr_key,
                "correct_answer_text": corr_text or opts.get(corr_key, ""),
                "is_correct": is_correct,
                "rationale": q.get("rationale") or q.get("explanation", ""),
                "objective_title": obj_name
            })
                
    mastery_percentage = round((correct_count / max(total_count, 1)) * 100, 1)
    
    objective_breakdown = {}
    for obj_name, stats in obj_stats.items():
        if stats["total"] > 0:
            objective_breakdown[obj_name] = round((stats["correct"] / stats["total"]) * 100, 1)
            
    submission = Submission(
        student_id=current_student.id,
        assignment_id=assignment.id,
        answers_json=json.dumps(data.answers),
        score=mastery_percentage,
        objective_breakdown_json=json.dumps(objective_breakdown)
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    
    # Mastery / Practice Signal Framing (§7)
    mastery_signal = "Mastery Achieved (Strong Foundation)" if mastery_percentage >= 75 else ("Developing Mastery (Review Concepts)" if mastery_percentage >= 50 else "Novice / Needs Practice")
    
    return {
        "message": "Complete assessment set submitted and auto-scored.",
        "submission_id": submission.id,
        "score": mastery_percentage,
        "mastery_signal": mastery_signal,
        "objective_breakdown": objective_breakdown,
        "total_questions": total_count,
        "correct_answers": correct_count,
        "question_evaluations": question_evaluations,
        "explanation": "Mastery signal reflects formative alignment with source objectives across the full unit."
    }

@router.get("/assets/{version_id}/download-pdf")
def download_material_pdf(
    version_id: int,
    db: Session = Depends(get_db),
    current_student: User = Depends(student_required_flexible)
):
    ver = db.query(AssetVersion).filter(AssetVersion.id == version_id, AssetVersion.status == "approved").first()
    if not ver:
        raise HTTPException(status_code=403, detail="Draft or unapproved materials cannot be downloaded.")
        
    asset = db.query(Asset).filter(Asset.id == ver.asset_id).first()
    unit = db.query(Unit).filter(Unit.id == asset.unit_id).first() if asset else None
    
    content = json.loads(ver.content_json)
    pdf_bytes = generate_learning_pack_pdf(
        unit_title=unit.title if unit else "Retrievo Pack",
        asset_title=content.get("title", asset.type.capitalize()),
        content_json=content
    )
    
    clean_unit = (unit.title if unit else 'Material').replace(' ', '_')
    filename = f"Retrievo_{clean_unit}_{asset.type}_{ver.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.get("/units/{unit_id}/download-pdf")
def download_unit_full_pack_pdf(
    unit_id: int,
    db: Session = Depends(get_db),
    current_student: User = Depends(student_required_flexible)
):
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found.")

    exp_ver = db.query(AssetVersion).join(Asset).filter(Asset.unit_id == unit.id, Asset.type == "explanation", AssetVersion.status == "approved").order_by(AssetVersion.version_no.desc()).first()
    ex_ver = db.query(AssetVersion).join(Asset).filter(Asset.unit_id == unit.id, Asset.type == "example", AssetVersion.status == "approved").order_by(AssetVersion.version_no.desc()).first()
    rev_ver = db.query(AssetVersion).join(Asset).filter(Asset.unit_id == unit.id, Asset.type == "revision_sheet", AssetVersion.status == "approved").order_by(AssetVersion.version_no.desc()).first()
    quiz_ver = db.query(AssetVersion).join(Asset).filter(Asset.unit_id == unit.id, Asset.type == "quiz", AssetVersion.status == "approved").order_by(AssetVersion.version_no.desc()).first()

    exp_json = json.loads(exp_ver.content_json) if exp_ver else {}
    ex_json = json.loads(ex_ver.content_json) if ex_ver else {}
    rev_json = json.loads(rev_ver.content_json) if rev_ver else {}
    quiz_json = json.loads(quiz_ver.content_json) if quiz_ver else {}

    glossary_list = [{"term": g.term, "canonical_wording": g.canonical_wording} for g in unit.glossary_terms]

    all_citations = []
    for j in [exp_json, ex_json, rev_json, quiz_json]:
        if "chunk_citations" in j and isinstance(j["chunk_citations"], list):
            all_citations.extend(j["chunk_citations"])
    all_citations = list(dict.fromkeys(all_citations))

    full_content = {
        "title": f"Complete Study Pack: {unit.title}",
        "explanation": exp_json.get("explanation", ""),
        "steps": ex_json.get("steps", []),
        "key_takeaways": rev_json.get("key_takeaways", []),
        "rapid_memory_triggers": rev_json.get("rapid_memory_triggers", rev_json.get("quick_recall_bullets", [])),
        "questions": quiz_json.get("questions", []),
        "glossary": glossary_list,
        "chunk_citations": all_citations
    }

    pdf_bytes = generate_learning_pack_pdf(
        unit_title=unit.title,
        asset_title="Full Study Pack",
        content_json=full_content
    )

    clean_filename = f"Retrievo_Study_Pack_{unit.title.replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{clean_filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


# ----------------------------------------------------------------------
# STUDENT HELP REQUESTS
# ----------------------------------------------------------------------
@router.post("/requests")
def create_student_help_request(
    data: StudentRequestCreate,
    db: Session = Depends(get_db),
    current_student: User = Depends(student_required)
):
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == current_student.id,
        Enrollment.classroom_id == data.classroom_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="You are not enrolled in this classroom.")
        
    req = StudentRequest(
        student_id=current_student.id,
        classroom_id=data.classroom_id,
        objective_id=data.objective_id,
        unit_id=data.unit_id,
        question_text=data.question_text.strip(),
        details=data.details,
        status="open"
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"id": req.id, "message": "Help request sent to instructor", "status": req.status}


@router.get("/requests")
def get_student_help_requests(
    classroom_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_student: User = Depends(student_required)
):
    query = db.query(StudentRequest).filter(StudentRequest.student_id == current_student.id)
    if classroom_id:
        query = query.filter(StudentRequest.classroom_id == classroom_id)
        
    requests_list = query.order_by(StudentRequest.created_at.desc()).all()
    res = []
    for r in requests_list:
        obj = db.query(Objective).filter(Objective.id == r.objective_id).first() if r.objective_id else None
        c = db.query(Classroom).filter(Classroom.id == r.classroom_id).first()
        u = db.query(Unit).filter(Unit.id == r.unit_id).first() if r.unit_id else None
        res.append({
            "id": r.id,
            "classroom_id": r.classroom_id,
            "classroom_name": c.name if c else "",
            "classroom_subject": c.subject if c else "",
            "unit_id": r.unit_id,
            "unit_title": u.title if u else None,
            "objective_id": r.objective_id,
            "objective_text": obj.text if obj else None,
            "question_text": r.question_text,
            "details": r.details,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "responses_count": len(r.responses),
            "responses": [{
                "id": resp.id,
                "user_name": resp.user.name if resp.user else "Instructor",
                "user_role": resp.user.role if resp.user else "teacher",
                "message": resp.message,
                "created_at": resp.created_at.isoformat()
            } for resp in r.responses]
        })
    return res


