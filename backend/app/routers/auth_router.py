from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import UserLogin, TeacherSignup, TokenResponse, UserResponse
from ..auth import verify_password, get_password_hash, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.get("/users-summary")
def get_users_summary(db: Session = Depends(get_db)):
    """
    Returns user directory from PostgreSQL database.
    """
    users = db.query(User).order_by(User.id.asc()).all()
    return [{
        "id": u.id,
        "role": u.role,
        "name": u.name,
        "email": u.email,
        "is_approved": u.is_approved
    } for u in users]

@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    email_clean = login_data.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    if user.role == "teacher" and not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your teacher account is pending administrator approval. Please contact the administrator."
        )
        
    token = create_access_token(data={"sub": str(user.id), "role": user.role, "name": user.name})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/teacher-signup")
def teacher_signup(signup_data: TeacherSignup, db: Session = Depends(get_db)):
    email_clean = signup_data.email.strip().lower()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )
        
    new_teacher = User(
        role="teacher",
        name=signup_data.name.strip(),
        email=email_clean,
        password_hash=get_password_hash(signup_data.password),
        is_approved=False
    )
    db.add(new_teacher)
    db.commit()
    db.refresh(new_teacher)
    
    return {
        "message": "Teacher signup submitted successfully! Your account is pending administrator approval.",
        "status": "pending",
        "teacher_id": new_teacher.id
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
