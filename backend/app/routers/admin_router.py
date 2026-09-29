from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import User, Classroom, Unit, Asset
from ..schemas import TeacherApprovalAction
from ..auth import admin_required

router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.get("/teachers")
def list_teachers(status_filter: Optional[str] = None, db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    query = db.query(User).filter(User.role == "teacher")
    if status_filter == "pending":
        query = query.filter(User.is_approved == False)
    elif status_filter == "approved":
        query = query.filter(User.is_approved == True)
        
    teachers = query.order_by(User.created_at.desc()).all()
    
    result = []
    for t in teachers:
        classroom_count = db.query(Classroom).filter(Classroom.teacher_id == t.id).count()
        unit_count = db.query(Unit).filter(Unit.teacher_id == t.id).count()
        result.append({
            "id": t.id,
            "name": t.name,
            "email": t.email,
            "is_approved": t.is_approved,
            "created_at": t.created_at,
            "classroom_count": classroom_count,
            "unit_count": unit_count
        })
    return result

@router.post("/teachers/action")
def approve_or_reject_teacher(action: TeacherApprovalAction, db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    teacher = db.query(User).filter(User.id == action.teacher_id, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
        
    if action.approved:
        teacher.is_approved = True
        teacher_id = teacher.id
        db.commit()
        msg = f"Teacher '{teacher.name}' has been APPROVED and can now log in."
        return {"message": msg, "teacher_id": teacher_id, "is_approved": True}
    else:
        teacher_name = teacher.name
        teacher_id = teacher.id
        db.delete(teacher)
        db.commit()
        msg = f"Teacher registration for '{teacher_name}' has been REJECTED and removed from the system."
        return {"message": msg, "teacher_id": teacher_id, "is_approved": False, "deleted": True}

@router.get("/stats")
def get_system_stats(db: Session = Depends(get_db), current_admin: User = Depends(admin_required)):
    total_teachers = db.query(User).filter(User.role == "teacher").count()
    pending_teachers = db.query(User).filter(User.role == "teacher", User.is_approved == False).count()
    approved_teachers = db.query(User).filter(User.role == "teacher", User.is_approved == True).count()
    total_students = db.query(User).filter(User.role == "student").count()
    total_classrooms = db.query(Classroom).count()
    total_units = db.query(Unit).count()
    total_assets = db.query(Asset).count()
    
    return {
        "total_teachers": total_teachers,
        "pending_teachers": pending_teachers,
        "approved_teachers": approved_teachers,
        "total_students": total_students,
        "total_classrooms": total_classrooms,
        "total_units": total_units,
        "total_assets": total_assets
    }
