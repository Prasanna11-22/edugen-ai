import os
import datetime
import hashlib
import jwt
from typing import Optional
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "lessonfoundry-royal-black-orange-secret-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours
SALT = "lessonfoundry_salt_royal_theme_2026"

security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)

def get_password_hash(password: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), SALT.encode("utf-8"), 100000).hex()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return get_password_hash(plain_password) == hashed_password

def create_access_token(data: dict, expires_delta: datetime.timedelta = None) -> str:
    to_encode = data.copy()
    # Ensure standard 'sub' claim is string for PyJWT specification
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    if expires_delta:
        expire = datetime.datetime.utcnow() + expires_delta
    else:
        expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub_val = payload.get("sub")
        if sub_val is None:
            raise credentials_exception
        user_id = int(sub_val)
    except Exception as e:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    
    # If teacher, must be approved
    if user.role == "teacher" and not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your teacher account is pending administrator approval."
        )
        
    return user

def get_current_user_flexible(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    token: Optional[str] = Query(None, alias="token"),
    db: Session = Depends(get_db)
) -> User:
    auth_token = None
    if credentials and credentials.credentials:
        auth_token = credentials.credentials
    elif token:
        auth_token = token
        
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(auth_token, SECRET_KEY, algorithms=[ALGORITHM])
        sub_val = payload.get("sub")
        if sub_val is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(sub_val)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
        
    if user.role == "teacher" and not user.is_approved:
        raise HTTPException(status_code=403, detail="Your teacher account is pending administrator approval.")
        
    return user

def admin_required(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privilege required."
        )
    return current_user

def teacher_required(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher privilege required."
        )
    return current_user

def student_required(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["student", "teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required."
        )
    return current_user

def student_required_flexible(current_user: User = Depends(get_current_user_flexible)) -> User:
    if current_user.role not in ["student", "teacher", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student access required."
        )
    return current_user
