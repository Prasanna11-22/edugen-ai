import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    User, Classroom, Enrollment, Unit, Asset, AssetVersion,
    Assignment, Submission, Objective
)
from ..schemas import JoinClassroomRequest, SubmitAssessmentRequest
from ..auth import student_required
from ..services.pdf_exporter import generate_learning_pack_pdf

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
            "joined_at": e.joined_at
        })
    return res

@router.post("/classrooms/join")
def join_classroom_by_code(data: JoinClassroomRequest, db: Session = Depends(get_db), current_student: User = Depends(student_required)):
    code = data.join_code.strip().upper()
    classroom = db.query(Classroom).filter(Classroom.join_code == code).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid join code. Classroom not found.")
        
    existing = db.query(Enrollment).filter(
        Enrollment.student_id == current_student.id,
        Enrollment.classroom_id == classroom.id
    ).first()
    if existing:
        return {"message": "You are already enrolled in this classroom.", "classroom_id": classroom.id}
        
    enrollment = Enrollment(student_id=current_student.id, classroom_id=classroom.id)
    db.add(enrollment)
    db.commit()
    
    return {"message": f"Successfully joined {classroom.name}!", "classroom_id": classroom.id}

@router.get("/materials")
def get_approved_materials(classroom_id: int, db: Session = Depends(get_db), current_student: User = Depends(student_required)):
    """
    CRITICAL SECURITY CHECK (§3.3 & §8):
    Student can ONLY access approved content assigned to their enrolled classroom.
    """
    # Verify enrollment
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == current_student.id,
        Enrollment.classroom_id == classroom_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="You are not enrolled in this classroom.")
        
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
            # Query all approved assets for this unit
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

            quiz_ver = db.query(AssetVersion).join(Asset).filter(
                Asset.unit_id == u.id,
                Asset.type == "quiz",
                AssetVersion.status == "approved"
            ).order_by(AssetVersion.version_no.desc()).first()

            all_vers = [v for v in [exp_ver, ex_ver, rev_ver, quiz_ver] if v]
            if not all_vers:
                continue

            exp_json = json.loads(exp_ver.content_json) if exp_ver else {}
            ex_json = json.loads(ex_ver.content_json) if ex_ver else {}
            rev_json = json.loads(rev_ver.content_json) if rev_ver else {}
            quiz_json = json.loads(quiz_ver.content_json) if quiz_ver else {}

            glossary_list = [{"id": g.id, "term": g.term, "canonical_wording": g.canonical_wording} for g in u.glossary_terms]
            objectives_list = [{"id": o.id, "text": o.text} for o in u.objectives]

            # Collect citations
            all_citations = []
            for j in [exp_json, ex_json, rev_json, quiz_json]:
                if "chunk_citations" in j and isinstance(j["chunk_citations"], list):
                    all_citations.extend(j["chunk_citations"])
            all_citations = list(dict.fromkeys(all_citations))

            # Build Full Consolidated Content
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
                "questions": quiz_json.get("questions", []),
                "glossary": glossary_list,
                "chunk_citations": all_citations,
                "explanation_pack": exp_json if exp_ver else None,
                "example_pack": ex_json if ex_ver else None,
                "revision_pack": rev_json if rev_ver else None,
                "quiz_pack": quiz_json if quiz_ver else None,
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
                    "has_quiz": quiz_ver is not None,
                    "has_glossary": len(glossary_list) > 0
                }
            })
                    
    return materials

@router.get("/assignments")
def get_assigned_assessments(classroom_id: int, db: Session = Depends(get_db), current_student: User = Depends(student_required)):
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == current_student.id,
        Enrollment.classroom_id == classroom_id
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="You are not enrolled in this classroom.")
        
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
                "question": q.get("question"),
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
        max_attempts = primary_assign.max_attempts or 1
        can_attempt = attempts_used < max_attempts
        latest_sub = submissions[0] if submissions else None
        
        res.append({
            "assignment_id": primary_assign.id,
            "unit_id": unit.id,
            "unit_title": unit.title,
            "asset_type": "unit_assessment_set",
            "title": f"Complete Formative Assessment: {unit.title}",
            "classroom_id": classroom.id,
            "classroom_name": classroom.name,
            "subject": classroom.subject,
            "domain": classroom.subject,
            "due_date": primary_assign.due_date,
            "max_attempts": max_attempts,
            "time_limit_minutes": primary_assign.time_limit_minutes or 15,
            "attempts_used": attempts_used,
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
            correct_ans = str(q.get("correct_answer", "")).strip().upper()
            
            student_ans = str(data.answers.get(full_q_id, data.answers.get(str(raw_id), ""))).strip().upper()
            if student_ans and student_ans == correct_ans:
                correct_count += 1
                obj_stats[obj_name]["correct"] += 1
                
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
        "explanation": "Mastery signal reflects formative alignment with source objectives across the full unit."
    }

@router.get("/assets/{version_id}/download-pdf")
def download_material_pdf(version_id: int, db: Session = Depends(get_db), current_student: User = Depends(student_required)):
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
    
    filename = f"Retrievo_{asset.type}_{ver.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/units/{unit_id}/download-pdf")
def download_unit_full_pack_pdf(unit_id: int, db: Session = Depends(get_db), current_student: User = Depends(student_required)):
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
        asset_title=f"Full Study Pack",
        content_json=full_content
    )

    clean_filename = f"Retrievo_Study_Pack_{unit.title.replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={clean_filename}"}
    )

