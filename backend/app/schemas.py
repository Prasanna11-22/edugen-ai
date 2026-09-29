from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

# Auth & User
class UserLogin(BaseModel):
    email: str
    password: str

class TeacherSignup(BaseModel):
    name: str
    email: str
    password: str
    institution: Optional[str] = None

class StudentCreate(BaseModel):
    name: str
    email: str
    password: Optional[str] = None
    classroom_id: Optional[int] = None

class BulkStudentCreate(BaseModel):
    classroom_id: Optional[int] = None
    students_raw: str # CSV or newline format "Name, email"

class UserResponse(BaseModel):
    id: int
    role: str
    name: str
    email: str
    is_approved: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TeacherApprovalAction(BaseModel):
    teacher_id: int
    approved: bool
    reason: Optional[str] = None

# Classroom
class ClassroomCreate(BaseModel):
    name: str
    subject: str

class ClassroomResponse(BaseModel):
    id: int
    teacher_id: int
    name: str
    subject: str
    join_code: str
    created_at: datetime
    student_count: Optional[int] = 0
    
    class Config:
        from_attributes = True

class JoinClassroomRequest(BaseModel):
    join_code: str

# Unit & Source
class ObjectiveInput(BaseModel):
    text: str
    target_level: Optional[str] = "High School"
    bloom_level: Optional[str] = "Understand" # Remember, Understand, Apply, Analyze, Evaluate, Create
    constraints: Optional[Dict[str, Any]] = None
    quiz_count: Optional[int] = 3

class UnitCreateRequest(BaseModel):
    title: str
    source_title: str
    raw_text: Optional[str] = None
    objectives: List[ObjectiveInput]

class GlossaryTermUpdate(BaseModel):
    term: str
    canonical_wording: str

# Asset Review & Generation
class GenerateAssetsRequest(BaseModel):
    unit_id: int
    regenerate_type: Optional[str] = None # None for full pack, or specific asset type
    target_objective_id: Optional[int] = None
    custom_prompt_mod: Optional[str] = None
    quiz_count: Optional[int] = None
    difficulty: Optional[str] = None # Easy, Medium, Hard

class AssetReviewAction(BaseModel):
    status: str # approved, needs_revision
    notes: Optional[str] = None

class InlineEditAsset(BaseModel):
    content_json: Dict[str, Any]

class QualityFlagOverride(BaseModel):
    flag_id: int
    teacher_note: str

# Assignment & Submission
class AssignmentCreate(BaseModel):
    asset_version_id: int
    classroom_id: int
    due_date: Optional[str] = None
    max_attempts: Optional[int] = 1
    time_limit_minutes: Optional[int] = 15

class UnitAssignToClassroomsRequest(BaseModel):
    unit_id: int
    classroom_ids: List[int]
    auto_approve: Optional[bool] = True
    due_date: Optional[str] = None
    max_attempts: Optional[int] = 1
    time_limit_minutes: Optional[int] = 15

class SubmitAssessmentRequest(BaseModel):
    assignment_id: int
    answers: Dict[str, Any] # e.g. {"q1": "A", "q2": "..."}

class SubmissionResponse(BaseModel):
    id: int
    student_id: int
    assignment_id: int
    score: float
    objective_breakdown: Dict[str, Any]
    submitted_at: datetime
