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
            assets = db.query(Asset).filter(
                Asset.unit_id == u.id,
                Asset.type.in_(["explanation", "example", "revision_sheet"])
            ).all()
            
            for a in assets:
                # ONLY fetch latest APPROVED version
                approved_ver = db.query(AssetVersion).filter(
                    AssetVersion.asset_id == a.id,
                    AssetVersion.status == "approved"
                ).order_by(AssetVersion.version_no.desc()).first()
                
                if approved_ver:
                    obj = db.query(Objective).filter(Objective.id == a.objective_id).first() if a.objective_id else None
                    materials.append({
                        "asset_id": a.id,
                        "version_id": approved_ver.id,
                        "unit_title": u.title,
                        "objective_text": obj.text if obj else "Unit Overview",
                        "type": a.type,
                        "version_no": approved_ver.version_no,
                        "content": json.loads(approved_ver.content_json),
                        "approved_at": approved_ver.approved_at
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
        unit_title=unit.title if unit else "LessonFoundry Pack",
        asset_title=content.get("title", asset.type.capitalize()),
        content_json=content
    )
    
    filename = f"LessonFoundry_{asset.type}_{ver.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
