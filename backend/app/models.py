import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(20), nullable=False) # admin, teacher, student
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    plain_password = Column(String(100), nullable=True)
    is_approved = Column(Boolean, default=False)
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relationships
    classrooms = relationship("Classroom", back_populates="teacher", cascade="all, delete-orphan")
    enrollments = relationship("Enrollment", back_populates="student", cascade="all, delete-orphan")
    sources = relationship("Source", back_populates="teacher", cascade="all, delete-orphan")
    units = relationship("Unit", back_populates="teacher", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="student", cascade="all, delete-orphan")


class Classroom(Base):
    __tablename__ = "classrooms"
    
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    subject = Column(String(100), nullable=False)
    join_code = Column(String(12), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    teacher = relationship("User", back_populates="classrooms")
    enrollments = relationship("Enrollment", back_populates="classroom", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="classroom", cascade="all, delete-orphan")


class Enrollment(Base):
    __tablename__ = "enrollments"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    student = relationship("User", back_populates="enrollments")
    classroom = relationship("Classroom", back_populates="enrollments")


class Source(Base):
    __tablename__ = "sources"
    
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    teacher = relationship("User", back_populates="sources")
    versions = relationship("SourceVersion", back_populates="source", cascade="all, delete-orphan")
    units = relationship("Unit", back_populates="source")


class SourceVersion(Base):
    __tablename__ = "source_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False)
    version_no = Column(Integer, nullable=False, default=1)
    file_path = Column(String(300), nullable=True)
    raw_text = Column(Text, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    source = relationship("Source", back_populates="versions")
    chunks = relationship("Chunk", back_populates="source_version", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"
    
    id = Column(Integer, primary_key=True, index=True)
    source_version_id = Column(Integer, ForeignKey("source_versions.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=True) # JSON float array
    
    source_version = relationship("SourceVersion", back_populates="chunks")


class Unit(Base):
    __tablename__ = "units"
    
    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=True)
    title = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    teacher = relationship("User", back_populates="units")
    source = relationship("Source", back_populates="units")
    objectives = relationship("Objective", back_populates="unit", cascade="all, delete-orphan")
    glossary_terms = relationship("Glossary", back_populates="unit", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="unit", cascade="all, delete-orphan")


class Objective(Base):
    __tablename__ = "objectives"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    text = Column(Text, nullable=False)
    target_level = Column(String(50), default="High School") # e.g. Grade 9-12, Undergraduate
    bloom_level = Column(String(50), default="Understand") # Remember, Understand, Apply, Analyze, Evaluate, Create
    constraints_json = Column(Text, default="{}") # vocabulary, length, answer-reveal policy
    
    unit = relationship("Unit", back_populates="objectives")
    assets = relationship("Asset", back_populates="objective")


class Glossary(Base):
    __tablename__ = "glossary"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    term = Column(String(100), nullable=False)
    canonical_wording = Column(Text, nullable=False)
    
    unit = relationship("Unit", back_populates="glossary_terms")


class Asset(Base):
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    objective_id = Column(Integer, ForeignKey("objectives.id"), nullable=True)
    type = Column(String(50), nullable=False) # explanation, example, quiz, practice_easy, practice_advanced, answer_key, revision_sheet
    
    unit = relationship("Unit", back_populates="assets")
    objective = relationship("Objective", back_populates="assets")
    versions = relationship("AssetVersion", back_populates="asset", cascade="all, delete-orphan")


class AssetVersion(Base):
    __tablename__ = "asset_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    version_no = Column(Integer, nullable=False, default=1)
    content_json = Column(Text, nullable=False) # JSON dictionary with rendered content, questions, examples, citations
    status = Column(String(30), default="draft") # draft, approved, needs_revision
    model_name = Column(String(100), default="gemini-flash")
    prompt_config_json = Column(Text, default="{}")
    source_version_id = Column(Integer, ForeignKey("source_versions.id"), nullable=True)
    chunk_ids = Column(Text, default="[]") # JSON list of chunk IDs used for provenance
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, nullable=True)
    
    asset = relationship("Asset", back_populates="versions")
    quality_flags = relationship("QualityFlag", back_populates="asset_version", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="asset_version")


class QualityFlag(Base):
    __tablename__ = "quality_flags"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_version_id = Column(Integer, ForeignKey("asset_versions.id"), nullable=False)
    flag_type = Column(String(60), nullable=False) # duplicate_question, answer_leakage, answer_key_mismatch, unsupported_claim, missing_coverage, difficulty_mismatch
    severity = Column(String(20), default="warning") # warning, error, info
    message = Column(Text, nullable=False)
    resolved_bool = Column(Boolean, default=False)
    resolved_by = Column(Integer, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    teacher_note = Column(Text, nullable=True)
    
    asset_version = relationship("AssetVersion", back_populates="quality_flags")


class Assignment(Base):
    __tablename__ = "assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_version_id = Column(Integer, ForeignKey("asset_versions.id"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    due_date = Column(DateTime, nullable=True)
    max_attempts = Column(Integer, default=1)
    time_limit_minutes = Column(Integer, default=15)
    status = Column(String(30), default="active") # active, closed
    
    asset_version = relationship("AssetVersion", back_populates="assignments")
    classroom = relationship("Classroom", back_populates="assignments")
    submissions = relationship("Submission", back_populates="assignment", cascade="all, delete-orphan")


class Submission(Base):
    __tablename__ = "submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    answers_json = Column(Text, nullable=False) # JSON submitted answers
    score = Column(Float, nullable=False, default=0.0) # Mastery percentage / score
    objective_breakdown_json = Column(Text, default="{}") # Breakdown by learning objective
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    student = relationship("User", back_populates="submissions")
    assignment = relationship("Assignment", back_populates="submissions")


class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(150), index=True, nullable=False)
    otp_code = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
