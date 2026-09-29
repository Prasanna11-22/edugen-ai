from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import random
import datetime
from ..database import get_db
from ..models import User, PasswordResetOTP
from ..schemas import (
    UserLogin, 
    TeacherSignup, 
    TokenResponse, 
    UserResponse,
    ForgotPasswordRequest,
    VerifyOTPRequest,
    ResetPasswordRequest
)
from ..auth import verify_password, get_password_hash, create_access_token, get_current_user
from ..services.email_service import send_otp_email

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
        plain_password=signup_data.password,
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

@router.post("/forgot-password/send-otp")
def send_forgot_password_otp(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email_clean = req.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please check and try again."
        )

    # Invalidate previous unused OTPs for this email
    db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == email_clean,
        PasswordResetOTP.is_used == False
    ).update({"is_used": True})

    # Generate 6-digit OTP
    otp_code = str(random.randint(100000, 999999))
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)

    otp_record = PasswordResetOTP(
        email=email_clean,
        otp_code=otp_code,
        expires_at=expires_at,
        is_used=False
    )
    db.add(otp_record)
    db.commit()

    # Dispatch email via lessonfoundrykce@gmail.com
    send_otp_email(email_clean, otp_code, user.name)

    return {
        "message": f"Verification OTP code sent to {email_clean}",
        "email": email_clean
    }

@router.post("/forgot-password/verify-otp")
def verify_forgot_password_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    email_clean = req.email.strip().lower()
    otp_clean = req.otp.strip()

    otp_record = db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == email_clean,
        PasswordResetOTP.otp_code == otp_clean,
        PasswordResetOTP.is_used == False
    ).order_by(PasswordResetOTP.id.desc()).first()

    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please verify the 6-digit code and try again."
        )

    if datetime.datetime.utcnow() > otp_record.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code."
        )

    return {
        "message": "Verification code is valid.",
        "valid": True
    }

@router.post("/forgot-password/reset-password")
def reset_forgot_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    email_clean = req.email.strip().lower()
    otp_clean = req.otp.strip()

    if len(req.new_password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters long."
        )

    otp_record = db.query(PasswordResetOTP).filter(
        PasswordResetOTP.email == email_clean,
        PasswordResetOTP.otp_code == otp_clean,
        PasswordResetOTP.is_used == False
    ).order_by(PasswordResetOTP.id.desc()).first()

    if not otp_record or datetime.datetime.utcnow() > otp_record.expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification session. Please request a new OTP code."
        )

    user = db.query(User).filter(User.email == email_clean).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found."
        )

    # Mark OTP as used
    otp_record.is_used = True

    # Update password
    user.password_hash = get_password_hash(req.new_password)
    user.plain_password = req.new_password # Sync directory plain password
    db.commit()

    return {
        "message": "Password reset successfully! You can now log in with your new password.",
        "email": email_clean
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

