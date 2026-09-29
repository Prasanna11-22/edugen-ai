import os
import json
import random
import string
import secrets
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    User, Classroom, Enrollment, Source, SourceVersion, Chunk, Unit,
    Objective, Glossary, Asset, AssetVersion, QualityFlag, Assignment, Submission
)
from ..schemas import (
    ClassroomCreate, StudentCreate, BulkStudentCreate, UnitCreateRequest,
    GenerateAssetsRequest, AssetReviewAction, InlineEditAsset, QualityFlagOverride,
    AssignmentCreate, GlossaryTermUpdate, UnitAssignToClassroomsRequest
)
from ..auth import teacher_required, get_password_hash
from ..services.pdf_parser import extract_text_from_pdf, clean_extracted_text
from ..services.chunker import semantic_chunk_text
from ..services.embeddings import generate_embeddings_for_chunks, retrieve_top_k_chunks
from ..services.rag_engine import (
    extract_glossary_from_source,
    generate_concept_explanation,
    generate_worked_example,
    generate_formative_quiz,
    generate_answer_key,
    generate_differentiated_practice,
    generate_revision_sheet
)
from ..services.guardrails import run_all_guardrails

router = APIRouter(prefix="/api/teacher", tags=["Teacher Studio"])

# -------------------------------------------------------------
# CLASSROOMS & STUDENTS
# -------------------------------------------------------------
@router.get("/classrooms")
def get_teacher_classrooms(db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    classrooms = db.query(Classroom).filter(Classroom.teacher_id == current_teacher.id).order_by(Classroom.created_at.desc()).all()
    res = []
    for c in classrooms:
        count = db.query(Enrollment).filter(Enrollment.classroom_id == c.id).count()
        res.append({
            "id": c.id,
            "name": c.name,
            "subject": c.subject,
            "join_code": c.join_code,
            "student_count": count,
            "created_at": c.created_at
        })
    return res

@router.post("/classrooms")
def create_classroom(data: ClassroomCreate, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    # Generate 6-char unique code
    join_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    classroom = Classroom(
        teacher_id=current_teacher.id,
        name=data.name.strip(),
        subject=data.subject.strip(),
        join_code=join_code
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    return classroom

@router.post("/students/create")
def create_student_account(data: StudentCreate, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    email_clean = data.email.strip().lower()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student with this email/username already exists.")
        
    plain_password = data.password or ("LF-" + secrets.token_hex(3).upper())
    student = User(
        role="student",
        name=data.name.strip(),
        email=email_clean,
        password_hash=get_password_hash(plain_password),
        plain_password=plain_password,
        is_approved=True,
        created_by=current_teacher.id
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    
    # Auto enroll if classroom_id provided
    if data.classroom_id:
        enrollment = Enrollment(student_id=student.id, classroom_id=data.classroom_id)
        db.add(enrollment)
        db.commit()
        
    return {
        "id": student.id,
        "name": student.name,
        "email": student.email,
        "temporary_password": plain_password,
        "password": plain_password,
        "classroom_id": data.classroom_id,
        "message": "Student created successfully. Credentials generated."
    }

@router.get("/students")
def get_teacher_students(db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    """
    Retrieves all student accounts created by the teacher, independent of classrooms.
    """
    students = db.query(User).filter(User.role == "student", User.created_by == current_teacher.id).order_by(User.id.desc()).all()
    res = []
    for s in students:
        enrollments = db.query(Enrollment).filter(Enrollment.student_id == s.id).all()
        enrolled_classes = []
        for enr in enrollments:
            c = db.query(Classroom).filter(Classroom.id == enr.classroom_id).first()
            if c:
                enrolled_classes.append({
                    "classroom_id": c.id,
                    "name": c.name,
                    "subject": c.subject,
                    "join_code": c.join_code
                })
        res.append({
            "id": s.id,
            "name": s.name,
            "email": s.email,
            "password": s.plain_password or "student123",
            "created_at": s.created_at,
            "enrolled_classrooms": enrolled_classes
        })
    return res

@router.post("/students/{student_id}/enroll")
def enroll_student_in_classroom(student_id: int, classroom_id: int, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id, Classroom.teacher_id == current_teacher.id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
        
    existing = db.query(Enrollment).filter(Enrollment.student_id == student.id, Enrollment.classroom_id == classroom.id).first()
    if existing:
        return {"message": f"Student {student.name} is already enrolled in {classroom.name}."}
        
    enr = Enrollment(student_id=student.id, classroom_id=classroom.id)
    db.add(enr)
    db.commit()
    return {"message": f"Successfully enrolled {student.name} in {classroom.name}."}

@router.post("/students/bulk")
def bulk_create_students(data: BulkStudentCreate, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    lines = [l.strip() for l in data.students_raw.split("\n") if l.strip()]
    created_list = []
    
    for line in lines:
        parts = [p.strip() for p in line.split(",")]
        name = parts[0]
        email = parts[1] if len(parts) > 1 else f"{name.lower().replace(' ', '.')}@school.edu"
        
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            plain_pwd = "LF-" + secrets.token_hex(3).upper()
            student = User(
                role="student",
                name=name,
                email=email,
                password_hash=get_password_hash(plain_pwd),
                plain_password=plain_pwd,
                is_approved=True,
                created_by=current_teacher.id
            )
            db.add(student)
            db.commit()
            db.refresh(student)
            
            if data.classroom_id:
                enrollment = Enrollment(student_id=student.id, classroom_id=data.classroom_id)
                db.add(enrollment)
                db.commit()
            
            created_list.append({
                "id": student.id,
                "name": student.name,
                "email": student.email,
                "password": plain_pwd
            })
            
    return {
        "created_count": len(created_list),
        "students": created_list,
        "message": f"Successfully created {len(created_list)} student accounts."
    }

# -------------------------------------------------------------
# UNITS & KNOWLEDGE SOURCE UPLOAD
# -------------------------------------------------------------
@router.get("/units")
def get_teacher_units(db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    units = db.query(Unit).filter(Unit.teacher_id == current_teacher.id).order_by(Unit.created_at.desc()).all()
    res = []
    for u in units:
        obj_count = db.query(Objective).filter(Objective.unit_id == u.id).count()
        asset_count = db.query(Asset).filter(Asset.unit_id == u.id).count()
        source = db.query(Source).filter(Source.id == u.source_id).first()
        
        # Determine assigned classrooms for this unit
        unit_asset_ids = [a.id for a in db.query(Asset.id).filter(Asset.unit_id == u.id).all()]
        unit_ver_ids = [v.id for v in db.query(AssetVersion.id).filter(AssetVersion.asset_id.in_(unit_asset_ids)).all()] if unit_asset_ids else []
        
        assigned_classes = []
        if unit_ver_ids:
            class_ids = db.query(Assignment.classroom_id).filter(
                Assignment.asset_version_id.in_(unit_ver_ids),
                Assignment.status == "active"
            ).distinct().all()
            class_ids = [c[0] for c in class_ids]
            if class_ids:
                classes = db.query(Classroom).filter(Classroom.id.in_(class_ids)).all()
                for c in classes:
                    assigned_classes.append({
                        "id": c.id,
                        "name": c.name,
                        "subject": c.subject,
                        "join_code": c.join_code
                    })
                    
        res.append({
            "id": u.id,
            "title": u.title,
            "source_title": source.title if source else "No Source",
            "source_id": u.source_id,
            "objectives_count": obj_count,
            "assets_count": asset_count,
            "created_at": u.created_at,
            "assigned_classrooms": assigned_classes,
            "is_assigned": len(assigned_classes) > 0
        })
    return res

@router.post("/preview-chunks")
async def preview_source_chunks(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    current_teacher: User = Depends(teacher_required)
):
    extracted_text = ""
    if file:
        file_bytes = await file.read()
        if file.filename.lower().endswith(".pdf"):
            extracted_text = extract_text_from_pdf(file_bytes)
        else:
            extracted_text = file_bytes.decode("utf-8", errors="ignore")
    elif raw_text:
        extracted_text = clean_extracted_text(raw_text)
    else:
        raise HTTPException(status_code=400, detail="Please upload a PDF file or paste source text.")
        
    if len(extracted_text.strip()) < 20:
        raise HTTPException(status_code=400, detail="Source text is too short to chunk.")
        
    chunks_data = semantic_chunk_text(extracted_text, target_tokens=400, overlap_pct=0.15)
    
    formatted_chunks = []
    for idx, c in enumerate(chunks_data):
        c_text = c.get("text", "")
        tokens = len(c_text.split())
        formatted_chunks.append({
            "chunk_index": idx + 1,
            "text": c_text,
            "token_count": tokens,
            "char_count": len(c_text),
            "preview": c_text[:180] + ("..." if len(c_text) > 180 else "")
        })
        
    return {
        "total_chunks": len(formatted_chunks),
        "total_characters": len(extracted_text),
        "total_tokens_estimated": sum(c["token_count"] for c in formatted_chunks),
        "target_boundary": "300-600 tokens (15% semantic overlap)",
        "chunks": formatted_chunks
    }

@router.post("/units/upload-and-create")
async def create_unit_with_source(
    title: str = Form(...),
    source_title: str = Form(...),
    objectives_json: str = Form(...), # JSON string of objectives array
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    extracted_text = ""
    file_path = None
    
    if file:
        file_bytes = await file.read()
        os.makedirs("uploads", exist_ok=True)
        file_path = f"uploads/{secrets.token_hex(6)}_{file.filename}"
        with open(file_path, "wb") as f:
            f.write(file_bytes)
            
        if file.filename.lower().endswith(".pdf"):
            extracted_text = extract_text_from_pdf(file_bytes)
        else:
            extracted_text = clean_extracted_text(file_bytes.decode("utf-8", errors="ignore"))
    elif raw_text:
        extracted_text = clean_extracted_text(raw_text)
    else:
        raise HTTPException(status_code=400, detail="Please upload a PDF source file or provide source text.")
        
    extracted_text = clean_extracted_text(extracted_text).replace('\x00', '')
    if len(extracted_text.strip()) < 30:
        raise HTTPException(status_code=400, detail="Source content is too short or unreadable.")
        
    # 1. Create Source & SourceVersion
    source = Source(teacher_id=current_teacher.id, title=source_title.strip().replace('\x00', ''))
    db.add(source)
    db.commit()
    db.refresh(source)
    
    source_version = SourceVersion(
        source_id=source.id,
        version_no=1,
        file_path=file_path,
        raw_text=extracted_text
    )
    db.add(source_version)
    db.commit()
    db.refresh(source_version)
    
    # 2. Chunk Source (300-600 tokens with 15% overlap)
    chunks_data = semantic_chunk_text(extracted_text, target_tokens=400, overlap_pct=0.15)
    chunk_texts = [clean_extracted_text(c["text"]).replace('\x00', '') for c in chunks_data]
    
    # 3. Embed Chunks
    embeddings = generate_embeddings_for_chunks(chunk_texts)
    
    chunk_records = []
    for idx, c in enumerate(chunks_data):
        clean_text_chunk = clean_extracted_text(c["text"]).replace('\x00', '')
        chunk_rec = Chunk(
            source_version_id=source_version.id,
            chunk_index=c["chunk_index"],
            text=clean_text_chunk,
            embedding_json=json.dumps(embeddings[idx]) if idx < len(embeddings) else "[]"
        )
        db.add(chunk_rec)
        chunk_records.append(chunk_rec)
    db.commit()
    
    # 4. Create Unit
    unit = Unit(
        teacher_id=current_teacher.id,
        source_id=source.id,
        title=title.strip().replace('\x00', '')
    )
    db.add(unit)
    db.commit()
    db.refresh(unit)
    
    # 5. Extract & Persist Canonical Glossary (§4.3)
    glossary_items = extract_glossary_from_source(extracted_text)
    for g in glossary_items:
        g_rec = Glossary(
            unit_id=unit.id,
            term=g["term"],
            canonical_wording=g["canonical_wording"]
        )
        db.add(g_rec)
    db.commit()
    
    # 6. Parse and Persist Objectives
    try:
        objs = json.loads(objectives_json)
    except:
        objs = [{"text": "Understand core concepts", "bloom_level": "Understand", "target_level": "High School"}]
        
    obj_records = []
    for o in objs:
        obj_rec = Objective(
            unit_id=unit.id,
            text=o.get("text", "").strip(),
            bloom_level=o.get("bloom_level", "Understand"),
            target_level=o.get("target_level", "High School"),
            constraints_json=json.dumps(o.get("constraints", {}))
        )
        db.add(obj_rec)
        obj_records.append(obj_rec)
    db.commit()
    
    return {
        "unit_id": unit.id,
        "title": unit.title,
        "source_id": source.id,
        "source_version_id": source_version.id,
        "chunks_count": len(chunk_records),
        "glossary_count": len(glossary_items),
        "objectives_count": len(obj_records),
        "message": "Unit created and source indexed successfully!"
    }

@router.get("/units/{unit_id}")
def get_unit_details(unit_id: int, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    unit = db.query(Unit).filter(Unit.id == unit_id, Unit.teacher_id == current_teacher.id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
        
    source = db.query(Source).filter(Source.id == unit.source_id).first()
    latest_source_version = db.query(SourceVersion).filter(SourceVersion.source_id == source.id).order_by(SourceVersion.version_no.desc()).first() if source else None
    
    chunks = []
    if latest_source_version:
        chunk_recs = db.query(Chunk).filter(Chunk.source_version_id == latest_source_version.id).order_by(Chunk.chunk_index.asc()).all()
        chunks = [{"id": c.id, "chunk_index": c.chunk_index, "text": c.text, "word_count": len(c.text.split())} for c in chunk_recs]
        
    objectives = db.query(Objective).filter(Objective.unit_id == unit.id).all()
    glossary = db.query(Glossary).filter(Glossary.unit_id == unit.id).all()
    
    # Assets & Latest Versions
    assets = db.query(Asset).filter(Asset.unit_id == unit.id).all()
    assets_data = []
    for a in assets:
        latest_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == a.id).order_by(AssetVersion.version_no.desc()).first()
        flags = db.query(QualityFlag).filter(QualityFlag.asset_version_id == latest_ver.id).all() if latest_ver else []
        
        assets_data.append({
            "asset_id": a.id,
            "type": a.type,
            "objective_id": a.objective_id,
            "latest_version": {
                "id": latest_ver.id,
                "version_no": latest_ver.version_no,
                "status": latest_ver.status,
                "content_json": json.loads(latest_ver.content_json) if latest_ver else {},
                "chunk_ids": json.loads(latest_ver.chunk_ids) if latest_ver and latest_ver.chunk_ids else [],
                "created_at": latest_ver.created_at,
                "approved_at": latest_ver.approved_at,
                "quality_flags": [
                    {
                        "id": f.id,
                        "flag_type": f.flag_type,
                        "severity": f.severity,
                        "message": f.message,
                        "resolved": f.resolved_bool,
                        "teacher_note": f.teacher_note
                    } for f in flags
                ]
            } if latest_ver else None
        })
        
    # Find assigned classrooms for this unit
    all_ver_ids = [v.id for a in unit.assets for v in a.versions]
    unit_assignments = db.query(Assignment).filter(Assignment.asset_version_id.in_(all_ver_ids)).all() if all_ver_ids else []
    assigned_c_ids = list(set([asn.classroom_id for asn in unit_assignments]))
    assigned_classrooms = [
        {"id": c.id, "name": c.name, "subject": c.subject, "join_code": c.join_code}
        for c in db.query(Classroom).filter(Classroom.id.in_(assigned_c_ids)).all()
    ]

    return {
        "unit": {
            "id": unit.id,
            "title": unit.title,
            "created_at": unit.created_at
        },
        "source": {
            "id": source.id if source else None,
            "title": source.title if source else "",
            "latest_version_no": latest_source_version.version_no if latest_source_version else 1,
            "chunks": chunks
        },
        "objectives": [
            {
                "id": o.id,
                "text": o.text,
                "bloom_level": o.bloom_level,
                "target_level": o.target_level,
                "constraints": json.loads(o.constraints_json) if o.constraints_json else {}
            } for o in objectives
        ],
        "glossary": [
            {
                "id": g.id,
                "term": g.term,
                "canonical_wording": g.canonical_wording
            } for g in glossary
        ],
        "assets": assets_data,
        "assigned_classrooms": assigned_classrooms
    }

@router.delete("/units/{unit_id}")
def delete_unit(unit_id: int, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    unit = db.query(Unit).filter(Unit.id == unit_id, Unit.teacher_id == current_teacher.id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Curriculum Unit not found")
        
    unit_title = unit.title
    source_id = unit.source_id

    # 1. Cleanly delete all associated assignments and submissions for all asset versions in this unit
    assets = db.query(Asset).filter(Asset.unit_id == unit.id).all()
    asset_ids = [a.id for a in assets]
    
    if asset_ids:
        versions = db.query(AssetVersion).filter(AssetVersion.asset_id.in_(asset_ids)).all()
        version_ids = [v.id for v in versions]
        
        if version_ids:
            assignments = db.query(Assignment).filter(Assignment.asset_version_id.in_(version_ids)).all()
            assignment_ids = [asn.id for asn in assignments]
            
            if assignment_ids:
                db.query(Submission).filter(Submission.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)
                db.query(Assignment).filter(Assignment.id.in_(assignment_ids)).delete(synchronize_session=False)
                
            db.query(QualityFlag).filter(QualityFlag.asset_version_id.in_(version_ids)).delete(synchronize_session=False)
            db.query(AssetVersion).filter(AssetVersion.id.in_(version_ids)).delete(synchronize_session=False)
            
        db.query(Asset).filter(Asset.id.in_(asset_ids)).delete(synchronize_session=False)
        db.flush()

    # 2. Delete objectives and glossary
    db.query(Objective).filter(Objective.unit_id == unit.id).delete(synchronize_session=False)
    db.query(Glossary).filter(Glossary.unit_id == unit.id).delete(synchronize_session=False)
    db.flush()
    
    # 3. Delete unit
    db.delete(unit)
    db.commit()
    
    # 4. Source cleanup: if source is only attached to this unit, delete chunks and source
    if source_id:
        other_units = db.query(Unit).filter(Unit.source_id == source_id).count()
        if other_units == 0:
            source = db.query(Source).filter(Source.id == source_id).first()
            if source:
                s_versions = db.query(SourceVersion).filter(SourceVersion.source_id == source.id).all()
                sv_ids = [sv.id for sv in s_versions]
                if sv_ids:
                    db.query(Chunk).filter(Chunk.source_version_id.in_(sv_ids)).delete(synchronize_session=False)
                    db.query(SourceVersion).filter(SourceVersion.id.in_(sv_ids)).delete(synchronize_session=False)
                db.delete(source)
                db.commit()
                
    return {
        "message": f"Lesson '{unit_title}' and all associated assets were removed successfully.",
        "unit_id": unit_id
    }

# -------------------------------------------------------------
# GLOSSARY MANAGEMENT (§4.3)
# -------------------------------------------------------------
@router.put("/glossary/{glossary_id}")
def update_glossary_term(glossary_id: int, data: GlossaryTermUpdate, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    term_rec = db.query(Glossary).filter(Glossary.id == glossary_id).first()
    if not term_rec:
        raise HTTPException(status_code=404, detail="Glossary term not found")
    term_rec.term = data.term.strip()
    term_rec.canonical_wording = data.canonical_wording.strip()
    db.commit()
    return {"message": "Glossary term updated successfully.", "id": term_rec.id}

# -------------------------------------------------------------
# RAG GENERATION & QUALITY GUARDRAILS ENGINE
# -------------------------------------------------------------
@router.post("/generate-learning-pack")
def generate_learning_pack(data: GenerateAssetsRequest, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    unit = db.query(Unit).filter(Unit.id == data.unit_id, Unit.teacher_id == current_teacher.id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
        
    source = db.query(Source).filter(Source.id == unit.source_id).first()
    latest_source_version = db.query(SourceVersion).filter(SourceVersion.source_id == source.id).order_by(SourceVersion.version_no.desc()).first() if source else None
    
    if not latest_source_version:
        raise HTTPException(status_code=400, detail="Unit has no indexed source chunks available.")
        
    chunks_records = db.query(Chunk).filter(Chunk.source_version_id == latest_source_version.id).order_by(Chunk.chunk_index.asc()).all()
    chunks = [{"id": c.id, "chunk_index": c.chunk_index, "text": c.text} for c in chunks_records]
    
    objectives = db.query(Objective).filter(Objective.unit_id == unit.id).all()
    glossary_records = db.query(Glossary).filter(Glossary.unit_id == unit.id).all()
    glossary = [{"term": g.term, "canonical_wording": g.canonical_wording} for g in glossary_records]
    
    if not objectives:
        raise HTTPException(status_code=400, detail="Please define at least one learning objective before generating.")
        
    created_assets = []
    
    # Generate assets per objective:
    # 1. Concept Explanation
    # 2. Worked Example
    # 3. Formative Quiz
    # 4. Practice Easy
    # 5. Practice Advanced
    for obj in objectives:
        # Retrieve candidate chunks for this objective (k=5, min_similarity=0.18)
        matched_chunks, is_gap, sim_score = retrieve_top_k_chunks(obj.text, chunks, top_k=5, min_similarity=0.18)
        
        if is_gap:
            # Insufficient source coverage gap!
            # As per §4.1: flag 'insufficient source for this objective' instead of generating hallucinated content
            gap_explanation = {
                "title": f"Coverage Gap: {obj.text[:40]}",
                "objective": obj.text,
                "gap_flag": True,
                "explanation": f"⚠️ INSUFFICIENT SOURCE FOR THIS OBJECTIVE (Max similarity: {round(sim_score, 3)}). The uploaded source document does not contain verifiable factual support for this objective. Please supplement the source material or adjust the learning objective contract.",
                "chunk_citations": [],
                "chunk_ids": []
            }
            # Save asset and flag
            asset = db.query(Asset).filter(Asset.unit_id == unit.id, Asset.objective_id == obj.id, Asset.type == "explanation").first()
            if not asset:
                asset = Asset(unit_id=unit.id, objective_id=obj.id, type="explanation")
                db.add(asset)
                db.commit()
                db.refresh(asset)
                
            asset_ver = AssetVersion(
                asset_id=asset.id,
                version_no=1,
                content_json=json.dumps(gap_explanation),
                status="needs_revision",
                source_version_id=latest_source_version.id,
                chunk_ids="[]"
            )
            db.add(asset_ver)
            db.commit()
            db.refresh(asset_ver)
            
            flag = QualityFlag(
                asset_version_id=asset_ver.id,
                flag_type="unsupported_claim",
                severity="error",
                message=f"Knowledge Gap: Insufficient source retrieval coverage for objective '{obj.text[:50]}'."
            )
            db.add(flag)
            db.commit()
            created_assets.append({"asset_id": asset.id, "type": "explanation", "gap": True})
            continue

        # Determine quiz question count and difficulty from constraints or request
        obj_constraints = json.loads(obj.constraints_json) if obj.constraints_json else {}
        q_count = data.quiz_count or obj_constraints.get("quiz_count", 3)
        diff_mode = data.difficulty or obj_constraints.get("difficulty", "Medium")

        # Grounded generation for supported objectives: ALL 7 DISTINCT ASSETS
        exp_data = generate_concept_explanation(obj.text, matched_chunks, glossary, obj.bloom_level, getattr(obj, "target_level", "Standard"))
        ex_data = generate_worked_example(obj.text, matched_chunks, glossary, "Apply")
        quiz_data = generate_formative_quiz(obj.text, matched_chunks, glossary, obj.bloom_level, num_questions=q_count, difficulty_mode=diff_mode)
        key_data = generate_answer_key(obj.text, quiz_data, matched_chunks)
        easy_data = generate_differentiated_practice(obj.text, matched_chunks, glossary, "easy")
        adv_data = generate_differentiated_practice(obj.text, matched_chunks, glossary, "advanced")
        rev_data = generate_revision_sheet(obj.text, matched_chunks, exp_data, ex_data, quiz_data, glossary)

        asset_blueprints = [
            ("explanation", exp_data),
            ("example", ex_data),
            ("quiz", quiz_data),
            ("answer_key", key_data),
            ("practice_easy", easy_data),
            ("practice_advanced", adv_data),
            ("revision_sheet", rev_data)
        ]
        
        for asset_type, content_data in asset_blueprints:
            # Find or create Asset
            asset = db.query(Asset).filter(Asset.unit_id == unit.id, Asset.objective_id == obj.id, Asset.type == asset_type).first()
            if not asset:
                asset = Asset(unit_id=unit.id, objective_id=obj.id, type=asset_type)
                db.add(asset)
                db.commit()
                db.refresh(asset)
                
            # Get latest version no
            prev_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == asset.id).order_by(AssetVersion.version_no.desc()).first()
            ver_no = (prev_ver.version_no + 1) if prev_ver else 1
            
            asset_ver = AssetVersion(
                asset_id=asset.id,
                version_no=ver_no,
                content_json=json.dumps(content_data),
                status="draft",
                source_version_id=latest_source_version.id,
                chunk_ids=json.dumps(content_data.get("chunk_ids", []))
            )
            db.add(asset_ver)
            db.commit()
            db.refresh(asset_ver)
            
            # Run Quality Guardrails (§5)
            flags = run_all_guardrails(
                asset_type=asset_type,
                content_json=content_data,
                retrieved_chunks=matched_chunks,
                requested_bloom_level=obj.bloom_level,
                objective_id=obj.id
            )
            for f in flags:
                q_flag = QualityFlag(
                    asset_version_id=asset_ver.id,
                    flag_type=f["flag_type"],
                    severity=f["severity"],
                    message=f["message"]
                )
                db.add(q_flag)
            db.commit()
            
            created_assets.append({"asset_id": asset.id, "type": asset_type, "version_no": ver_no, "flags_count": len(flags)})

    return {
        "message": f"Successfully generated learning pack ({len(created_assets)} assets created/versioned).",
        "assets_generated": created_assets
    }

# -------------------------------------------------------------
# SINGLE-ITEM REGENERATION & INLINE EDITING (§3.2 & §8)
# -------------------------------------------------------------
@router.post("/regenerate-asset")
def regenerate_single_asset(
    data: GenerateAssetsRequest,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    unit = db.query(Unit).filter(Unit.id == data.unit_id, Unit.teacher_id == current_teacher.id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
        
    source = db.query(Source).filter(Source.id == unit.source_id).first()
    latest_source_version = db.query(SourceVersion).filter(SourceVersion.source_id == source.id).order_by(SourceVersion.version_no.desc()).first()
    chunks_records = db.query(Chunk).filter(Chunk.source_version_id == latest_source_version.id).order_by(Chunk.chunk_index.asc()).all()
    chunks = [{"id": c.id, "chunk_index": c.chunk_index, "text": c.text} for c in chunks_records]
    
    obj = db.query(Objective).filter(Objective.id == data.target_objective_id).first() if data.target_objective_id else db.query(Objective).filter(Objective.unit_id == unit.id).first()
    glossary_records = db.query(Glossary).filter(Glossary.unit_id == unit.id).all()
    glossary = [{"term": g.term, "canonical_wording": g.canonical_wording} for g in glossary_records]
    
    matched_chunks, is_gap, sim_score = retrieve_top_k_chunks(obj.text, chunks, top_k=5, min_similarity=0.18)
    
    obj_constraints = json.loads(obj.constraints_json) if obj.constraints_json else {}
    q_count = data.quiz_count or obj_constraints.get("quiz_count", 3)
    diff_mode = data.difficulty or obj_constraints.get("difficulty", "Medium")
    
    asset_type = data.regenerate_type or "explanation"
    if asset_type == "explanation":
        new_content = generate_concept_explanation(obj.text, matched_chunks, glossary, obj.bloom_level, getattr(obj, "target_level", "Standard"))
    elif asset_type == "example":
        new_content = generate_worked_example(obj.text, matched_chunks, glossary, "Apply")
    elif asset_type == "quiz":
        new_content = generate_formative_quiz(obj.text, matched_chunks, glossary, obj.bloom_level, num_questions=q_count, difficulty_mode=diff_mode)
        # Also sync Answer Key asset version
        sync_key = generate_answer_key(obj.text, new_content, matched_chunks)
        ak_asset = db.query(Asset).filter(Asset.unit_id == unit.id, Asset.objective_id == obj.id, Asset.type == "answer_key").first()
        if ak_asset:
            ak_prev_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == ak_asset.id).order_by(AssetVersion.version_no.desc()).first()
            ak_ver_no = (ak_prev_ver.version_no + 1) if ak_prev_ver else 1
            ak_new_ver = AssetVersion(
                asset_id=ak_asset.id,
                version_no=ak_ver_no,
                content_json=json.dumps(sync_key),
                status="draft",
                source_version_id=latest_source_version.id,
                chunk_ids=json.dumps(sync_key.get("chunk_ids", []))
            )
            db.add(ak_new_ver)
            db.commit()
    elif asset_type == "answer_key":
        quiz_data = generate_formative_quiz(obj.text, matched_chunks, glossary, obj.bloom_level, num_questions=q_count, difficulty_mode=diff_mode)
        new_content = generate_answer_key(obj.text, quiz_data, matched_chunks)
    elif asset_type == "practice_easy":
        new_content = generate_differentiated_practice(obj.text, matched_chunks, glossary, "easy")
    elif asset_type == "practice_advanced":
        new_content = generate_differentiated_practice(obj.text, matched_chunks, glossary, "advanced")
    elif asset_type == "revision_sheet":
        exp_c = generate_concept_explanation(obj.text, matched_chunks, glossary, obj.bloom_level)
        ex_c = generate_worked_example(obj.text, matched_chunks, glossary, "Apply")
        qz_c = generate_formative_quiz(obj.text, matched_chunks, glossary, obj.bloom_level, num_questions=q_count)
        new_content = generate_revision_sheet(obj.text, matched_chunks, exp_c, ex_c, qz_c, glossary)
    else:
        new_content = generate_concept_explanation(obj.text, matched_chunks, glossary, obj.bloom_level)
        
    asset = db.query(Asset).filter(Asset.unit_id == unit.id, Asset.objective_id == obj.id, Asset.type == asset_type).first()
    if not asset:
        asset = Asset(unit_id=unit.id, objective_id=obj.id, type=asset_type)
        db.add(asset)
        db.commit()
        db.refresh(asset)
        
    prev_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == asset.id).order_by(AssetVersion.version_no.desc()).first()
    new_version_no = (prev_ver.version_no + 1) if prev_ver else 1
    
    new_ver = AssetVersion(
        asset_id=asset.id,
        version_no=new_version_no,
        content_json=json.dumps(new_content),
        status="draft",
        source_version_id=latest_source_version.id,
        chunk_ids=json.dumps(new_content.get("chunk_ids", []))
    )
    db.add(new_ver)
    db.commit()
    db.refresh(new_ver)
    
    # Run Guardrails
    flags = run_all_guardrails(
        asset_type=asset_type,
        content_json=new_content,
        retrieved_chunks=matched_chunks,
        requested_bloom_level=obj.bloom_level,
        objective_id=obj.id
    )
    for f in flags:
        q_flag = QualityFlag(
            asset_version_id=new_ver.id,
            flag_type=f["flag_type"],
            severity=f["severity"],
            message=f["message"]
        )
        db.add(q_flag)
    db.commit()
    
    return {
        "message": f"Regenerated {asset_type} as immutable Version {new_version_no}.",
        "asset_id": asset.id,
        "version_id": new_ver.id,
        "version_no": new_version_no,
        "content_json": new_content,
        "quality_flags_count": len(flags)
    }

@router.put("/asset-versions/{version_id}/inline-edit")
def inline_edit_asset(version_id: int, data: InlineEditAsset, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    ver = db.query(AssetVersion).filter(AssetVersion.id == version_id).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Asset version not found")
        
    if ver.status == "approved":
        raise HTTPException(status_code=400, detail="Approved versions are immutable. Please regenerate to create a new draft version.")
        
    ver.content_json = json.dumps(data.content_json)
    db.commit()
    return {"message": "Content updated successfully.", "version_id": ver.id}

@router.post("/asset-versions/{version_id}/approve")
def approve_asset_version(version_id: int, action: AssetReviewAction, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    ver = db.query(AssetVersion).filter(AssetVersion.id == version_id).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Asset version not found")
        
    # Check unresolved error flags
    unresolved_errors = db.query(QualityFlag).filter(
        QualityFlag.asset_version_id == ver.id,
        QualityFlag.severity == "error",
        QualityFlag.resolved_bool == False
    ).count()
    
    if action.status == "approved" and unresolved_errors > 0 and not action.notes:
        raise HTTPException(
            status_code=400,
            detail=f"Approval blocked: This asset has {unresolved_errors} unresolved quality error(s). Please resolve or provide an explicit override note."
        )
        
    ver.status = action.status
    if action.status == "approved":
        ver.approved_at = datetime.utcnow()
        ver.approved_by = current_teacher.id
        
    db.commit()
    return {
        "message": f"Asset version marked as '{ver.status}'.",
        "version_id": ver.id,
        "status": ver.status,
        "approved_at": ver.approved_at
    }

@router.post("/units/{unit_id}/approve-all")
def approve_all_unit_assets(unit_id: int, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    unit = db.query(Unit).filter(Unit.id == unit_id, Unit.teacher_id == current_teacher.id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
        
    assets = db.query(Asset).filter(Asset.unit_id == unit.id).all()
    approved_count = 0
    
    for a in assets:
        latest_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == a.id).order_by(AssetVersion.version_no.desc()).first()
        if latest_ver and latest_ver.status != "approved":
            latest_ver.status = "approved"
            latest_ver.approved_at = datetime.utcnow()
            latest_ver.approved_by = current_teacher.id
            approved_count += 1
            
    db.commit()
    return {
        "message": f"All {approved_count} asset(s) in pack '{unit.title}' have been approved successfully.",
        "unit_id": unit.id,
        "approved_count": approved_count
    }

@router.post("/quality-flags/override")
def override_quality_flag(data: QualityFlagOverride, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    flag = db.query(QualityFlag).filter(QualityFlag.id == data.flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Quality flag not found")
        
    flag.resolved_bool = True
    flag.resolved_by = current_teacher.id
    flag.resolved_at = datetime.utcnow()
    flag.teacher_note = data.teacher_note.strip()
    db.commit()
    
    return {"message": "Quality flag overridden with teacher note.", "flag_id": flag.id}

# -------------------------------------------------------------
# ASSIGNMENTS & ANALYTICS ALIGNMENT MAP (§3.2 & §7)
# -------------------------------------------------------------
@router.post("/assignments")
def create_assignment(data: AssignmentCreate, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    ver = db.query(AssetVersion).filter(AssetVersion.id == data.asset_version_id).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Asset version not found")
        
    if ver.status != "approved":
        raise HTTPException(status_code=400, detail="Only APPROVED content can be assigned to students (§3.2).")
        
    classroom = db.query(Classroom).filter(Classroom.id == data.classroom_id, Classroom.teacher_id == current_teacher.id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
        
    due = None
    if data.due_date:
        try:
            due = datetime.fromisoformat(data.due_date.replace("Z", "+00:00"))
        except:
            pass
            
    assignment = Assignment(
        asset_version_id=ver.id,
        classroom_id=classroom.id,
        due_date=due,
        max_attempts=data.max_attempts or 1,
        status="active"
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    
    return {"message": "Assessment assigned to classroom successfully.", "assignment_id": assignment.id}

@router.post("/units/assign-to-classrooms")
def assign_unit_to_classrooms(data: UnitAssignToClassroomsRequest, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    unit = db.query(Unit).filter(Unit.id == data.unit_id, Unit.teacher_id == current_teacher.id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
        
    if not data.classroom_ids:
        raise HTTPException(status_code=400, detail="Please select at least one classroom.")
        
    classrooms = db.query(Classroom).filter(
        Classroom.id.in_(data.classroom_ids),
        Classroom.teacher_id == current_teacher.id
    ).all()
    if not classrooms:
        raise HTTPException(status_code=404, detail="No valid classrooms found.")
        
    due = None
    if data.due_date:
        try:
            due = datetime.fromisoformat(data.due_date.replace("Z", "+00:00"))
        except:
            pass

    # Get all assets in this unit
    assets = db.query(Asset).filter(Asset.unit_id == unit.id).all()
    
    assigned_count = 0
    assigned_class_names = [c.name for c in classrooms]
    time_limit = data.time_limit_minutes or 15
    
    for asset in assets:
        # Latest version
        latest_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == asset.id).order_by(AssetVersion.version_no.desc()).first()
        if not latest_ver:
            continue
            
        if data.auto_approve and latest_ver.status != "approved":
            latest_ver.status = "approved"
            latest_ver.approved_at = datetime.utcnow()
            latest_ver.approved_by = current_teacher.id
            db.commit()
            
        # ONLY create Assignment records for assessment assets (quiz, practice_easy, practice_advanced)
        # Study materials (explanation, example, revision_sheet) are delivered via get_approved_materials
        if asset.type in ["quiz", "practice_easy", "practice_advanced"] and latest_ver.status == "approved":
            # Verify asset actually has questions
            try:
                content = json.loads(latest_ver.content_json)
                has_questions = len(content.get("questions", [])) > 0
            except:
                has_questions = False
                
            if has_questions:
                for c in classrooms:
                    existing = db.query(Assignment).filter(
                        Assignment.asset_version_id == latest_ver.id,
                        Assignment.classroom_id == c.id
                    ).first()
                    if not existing:
                        new_assign = Assignment(
                            asset_version_id=latest_ver.id,
                            classroom_id=c.id,
                            due_date=due,
                            max_attempts=data.max_attempts or 1,
                            time_limit_minutes=time_limit,
                            status="active"
                        )
                        db.add(new_assign)
                        assigned_count += 1
                    else:
                        existing.time_limit_minutes = time_limit
                        if due:
                            existing.due_date = due
                        if data.max_attempts:
                            existing.max_attempts = data.max_attempts
                    
    db.commit()
    
    return {
        "message": f"Lesson pack '{unit.title}' successfully assigned to {len(classrooms)} classroom(s) ({', '.join(assigned_class_names)}) with {time_limit}-min time limit!",
        "unit_id": unit.id,
        "assigned_classrooms": [{"id": c.id, "name": c.name} for c in classrooms],
        "assignments_created": assigned_count,
        "time_limit_minutes": time_limit
    }

@router.get("/assignments")
def get_teacher_assignments(db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    classrooms = db.query(Classroom).filter(Classroom.teacher_id == current_teacher.id).all()
    c_ids = [c.id for c in classrooms]
    assignments = db.query(Assignment).filter(Assignment.classroom_id.in_(c_ids)).order_by(Assignment.id.desc()).all()
    
    res = []
    for a in assignments:
        ver = db.query(AssetVersion).filter(AssetVersion.id == a.asset_version_id).first()
        asset = db.query(Asset).filter(Asset.id == ver.asset_id).first() if ver else None
        classroom = db.query(Classroom).filter(Classroom.id == a.classroom_id).first()
        submission_count = db.query(Submission).filter(Submission.assignment_id == a.id).count()
        
        res.append({
            "id": a.id,
            "classroom_name": classroom.name if classroom else "",
            "asset_type": asset.type if asset else "",
            "version_no": ver.version_no if ver else 1,
            "status": a.status,
            "due_date": a.due_date,
            "submissions_count": submission_count
        })
    return res

@router.get("/classrooms/{classroom_id}/analytics")
def get_classroom_analytics(classroom_id: int, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id, Classroom.teacher_id == current_teacher.id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
        
    assignments = db.query(Assignment).filter(Assignment.classroom_id == classroom.id).all()
    a_ids = [a.id for a in assignments]
    submissions = db.query(Submission).filter(Submission.assignment_id.in_(a_ids)).all()
    
    enrollments = db.query(Enrollment).filter(Enrollment.classroom_id == classroom.id).order_by(Enrollment.joined_at.desc()).all()
    enrolled_students = []
    for enr in enrollments:
        stu = db.query(User).filter(User.id == enr.student_id).first()
        if stu:
            sub_count = db.query(Submission).filter(Submission.student_id == stu.id, Submission.assignment_id.in_(a_ids)).count() if a_ids else 0
            latest_sub = db.query(Submission).filter(Submission.student_id == stu.id, Submission.assignment_id.in_(a_ids)).order_by(Submission.submitted_at.desc()).first() if a_ids else None
            enrolled_students.append({
                "id": stu.id,
                "name": stu.name,
                "email": stu.email,
                "password": stu.plain_password or "student123",
                "joined_at": enr.joined_at,
                "attempts_count": sub_count,
                "latest_score": latest_sub.score if latest_sub else None
            })
    
    # Calculate objective alignment map
    obj_scores = {}
    student_scores = []
    
    for sub in submissions:
        student = db.query(User).filter(User.id == sub.student_id).first()
        try:
            breakdown = json.loads(sub.objective_breakdown_json)
        except:
            breakdown = {}
            
        for obj_title, score_val in breakdown.items():
            if obj_title not in obj_scores:
                obj_scores[obj_title] = []
            obj_scores[obj_title].append(score_val)
            
        student_scores.append({
            "student_name": student.name if student else "Unknown",
            "student_email": student.email if student else "",
            "score": sub.score,
            "submitted_at": sub.submitted_at,
            "objective_breakdown": breakdown
        })
        
    alignment_map = []
    for obj_name, scores in obj_scores.items():
        avg_mastery = sum(scores) / len(scores) if scores else 0
        alignment_map.append({
            "objective": obj_name,
            "average_mastery": round(avg_mastery, 1),
            "sample_size": len(scores),
            "mastery_signal": "Mastery Achieved" if avg_mastery >= 75 else ("Developing" if avg_mastery >= 50 else "Needs Practice")
        })
        
    return {
        "classroom_name": classroom.name,
        "total_enrolled": len(enrolled_students),
        "total_submissions": len(submissions),
        "enrolled_students": enrolled_students,
        "objective_alignment_map": alignment_map,
        "student_results": student_scores
    }
