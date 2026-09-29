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

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

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
    low_confidence_objective_ids: Optional[List[int]] = []
    low_confidence_objective_texts: Optional[List[str]] = []

class ObjectiveCoverageCheckRequest(BaseModel):
    objective_text: str
    unit_id: Optional[int] = None
    source_text: Optional[str] = None
    chunks: Optional[List[str]] = None
    threshold: Optional[float] = 0.55

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

# Self-Paced Practice & AI Generation
class SelfPacedTestGenerateRequest(BaseModel):
    unit_id: Optional[int] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = "Medium" # Easy, Medium, Hard / Advanced
    num_questions: Optional[int] = 5
    bloom_level: Optional[str] = "Apply"

class DiagnosticPoolRequest(BaseModel):
    unit_id: Optional[int] = None
    topic: Optional[str] = None
    questions_per_tier: Optional[int] = 3 # Generates 3 Easy, 3 Medium, 3 Hard questions = 9 total

class DiagnosticEvaluateRequest(BaseModel):
    unit_id: Optional[int] = None
    unit_title: Optional[str] = None
    answers_history: List[Dict[str, Any]] = [] # [{ question_id, concept_topic, difficulty_tier, is_correct, selected_option, correct_option }]

# Per-Question Selective Regeneration
class QuizItemSelectiveRegenRequest(BaseModel):
    item_ids: Optional[List[Any]] = []
    selected_item_ids: Optional[List[Any]] = []
    asset_id: Optional[int] = None
    regen_reason_category: Optional[str] = "Other" # Duplicate, Too easy/hard, Ambiguous wording, Factually incorrect, Answer leakage, Other
    regen_reason_comment: Optional[str] = ""

class QuizItemStatusUpdate(BaseModel):
    status: str # draft, approved, needs_revision

class QuizItemEditRequest(BaseModel):
    question_text: str
    options: Dict[str, str]
    correct_option_id: str
    correct_answer_text: Optional[str] = None
    rationale: Optional[str] = None
    difficulty_tier: Optional[str] = "Medium"
    bloom_level: Optional[str] = "Understand"
    source_citation: Optional[str] = None
    edit_reason: Optional[str] = "Teacher Manual Edit"

# Student Help Requests
class StudentRequestCreate(BaseModel):
    classroom_id: int
    objective_id: Optional[int] = None
    unit_id: Optional[int] = None
    question_text: str
    details: Optional[str] = None

class StudentRequestStatusUpdate(BaseModel):
    status: str # open, in_progress, resolved, closed

class StudentRequestResponseCreate(BaseModel):
    message: str

# OCR & Review-by-Exception Schemas
class OCRPageResponse(BaseModel):
    id: Optional[int] = None
    page_number: int
    source_id: Optional[int] = None
    source_version_id: Optional[int] = None
    image_path: Optional[str] = None
    ocr_raw_text: str
    reviewed_text: Optional[str] = None
    confidence_score: float
    review_status: str # auto_accepted, needs_review, reviewed
    has_uncertain_spans: bool
    uncertain_spans: List[Dict[str, Any]] = []
    uncertain_count: int = 0
    ocr_provider: Optional[str] = "gemini_vision"
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    teacher_notes: Optional[str] = None
    created_at: Optional[datetime] = None

class SourcePageReviewRequest(BaseModel):
    reviewed_text: Optional[str] = None
    review_status: Optional[str] = "reviewed" # reviewed, auto_accepted, needs_review
    teacher_notes: Optional[str] = None

class BatchOCRResponse(BaseModel):
    total_pages: int
    auto_accepted_count: int
    needs_review_count: int
    reviewed_count: int = 0
    can_proceed_to_chunking: bool
    confidence_threshold: float = 0.85
    message: str
    pages: List[OCRPageResponse]

class OCRSummaryResponse(BaseModel):
    source_id: Optional[int] = None
    total_pages: int
    auto_accepted_count: int
    needs_review_count: int
    reviewed_count: int = 0
    can_proceed_to_chunking: bool
    confidence_threshold: float = 0.85

# Validation Layer Schemas
class ObjectiveValidationRequest(BaseModel):
    text: str
    target_level: Optional[str] = "High School"
    bloom_level: Optional[str] = "Understand"
    existing_objectives: Optional[List[str]] = []
    unit_id: Optional[int] = None

class OCRCorrectionValidationRequest(BaseModel):
    original_ocr_text: str
    teacher_text: str
    page_id: Optional[int] = None
    page_number: Optional[int] = 1

class GlossaryTermValidationRequest(BaseModel):
    term: str
    canonical_wording: Optional[str] = ""
    unit_id: Optional[int] = None
    source_chunks: Optional[List[str]] = []
    glossary_id: Optional[int] = None

class AssetEditValidationRequest(BaseModel):
    asset_type: str
    content_json: Dict[str, Any]
    unit_id: Optional[int] = None
    version_id: Optional[int] = None

class ValidationFlagResolutionRequest(BaseModel):
    resolution: str # used_suggestion, kept_original, edited_manually
    final_value: Optional[str] = None

