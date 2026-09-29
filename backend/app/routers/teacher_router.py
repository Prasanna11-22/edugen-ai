import os
import json
import random
import string
import secrets
from typing import List, Optional
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    User, Classroom, Enrollment, Source, SourceVersion, Chunk, Unit,
    Objective, Glossary, Asset, AssetVersion, QualityFlag, Assignment, Submission,
    QuizItem, QuizItemVersion, StudentRequest, RequestResponse, SourcePage
)
from ..schemas import (
    ClassroomCreate, StudentCreate, BulkStudentCreate, UnitCreateRequest,
    GenerateAssetsRequest, AssetReviewAction, InlineEditAsset, QualityFlagOverride,
    AssignmentCreate, GlossaryTermUpdate, UnitAssignToClassroomsRequest,
    QuizItemSelectiveRegenRequest, QuizItemStatusUpdate, QuizItemEditRequest,
    StudentRequestCreate, StudentRequestStatusUpdate, StudentRequestResponseCreate
)
from ..auth import teacher_required, get_password_hash
from ..services.pdf_parser import extract_text_from_file_or_image, extract_text_from_pdf, clean_extracted_text
from ..services.chunker import semantic_chunk_text
from ..services.embeddings import generate_embeddings_for_chunks, retrieve_top_k_chunks
from ..services.rag_engine import (
    extract_glossary_from_source,
    generate_concept_explanation,
    generate_worked_example,
    generate_formative_quiz,
    generate_answer_key,
    generate_differentiated_practice,
    generate_revision_sheet,
    regenerate_single_quiz_item
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
        extracted_text = extract_text_from_file_or_image(file_bytes, file.filename)
    elif raw_text:
        extracted_text = clean_extracted_text(raw_text)
    else:
        raise HTTPException(status_code=400, detail="Please upload a document file (PDF, Handwritten Note, Image) or paste source text.")
        
    if len(extracted_text.strip()) < 15:
        raise HTTPException(status_code=400, detail="Source text is too short or could not be extracted. Please ensure the document is clear.")
        
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
            
        extracted_text = extract_text_from_file_or_image(file_bytes, file.filename)
    elif raw_text:
        extracted_text = clean_extracted_text(raw_text)
    else:
        raise HTTPException(status_code=400, detail="Please upload a source document (PDF, Handwritten Note, Image) or provide source text.")
        
    extracted_text = clean_extracted_text(extracted_text).replace('\x00', '')
    if len(extracted_text.strip()) < 15:
        raise HTTPException(status_code=400, detail="Source content is too short or unreadable. Please check the document.")
        
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
        
        all_vers = db.query(AssetVersion).filter(AssetVersion.asset_id == a.id).order_by(AssetVersion.version_no.desc()).all()
        versions_list = []
        for v in all_vers:
            v_content = json.loads(v.content_json) if v.content_json else {}
            versions_list.append({
                "id": v.id,
                "version_no": v.version_no,
                "status": v.status,
                "created_at": v.created_at,
                "approved_at": v.approved_at,
                "questions_count": len(v_content.get("questions", [])) if a.type == "quiz" else None
            })

        assets_data.append({
            "asset_id": a.id,
            "type": a.type,
            "objective_id": a.objective_id,
            "all_versions": versions_list,
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

    # 1. Cleanly delete all associated assets, quiz items, versions, assignments, and submissions
    assets = db.query(Asset).filter(Asset.unit_id == unit.id).all()
    asset_ids = [a.id for a in assets]
    
    if asset_ids:
        # A. Clean up QuizItems and QuizItemVersions attached to these assets
        quiz_items = db.query(QuizItem).filter(QuizItem.asset_id.in_(asset_ids)).all()
        quiz_item_ids = [qi.id for qi in quiz_items]
        if quiz_item_ids:
            db.query(QuizItemVersion).filter(QuizItemVersion.quiz_item_id.in_(quiz_item_ids)).delete(synchronize_session=False)
            db.query(QuizItem).filter(QuizItem.id.in_(quiz_item_ids)).delete(synchronize_session=False)

        # B. Clean up AssetVersions, Assignments, Submissions, and QualityFlags
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

    # 2. Clean up StudentRequests and RequestResponses attached to this unit or its objectives
    objectives = db.query(Objective).filter(Objective.unit_id == unit.id).all()
    objective_ids = [o.id for o in objectives]
    
    req_query = db.query(StudentRequest).filter(
        (StudentRequest.unit_id == unit.id) |
        ((StudentRequest.objective_id.in_(objective_ids)) if objective_ids else False)
    )
    student_reqs = req_query.all()
    req_ids = [r.id for r in student_reqs]
    if req_ids:
        db.query(RequestResponse).filter(RequestResponse.request_id.in_(req_ids)).delete(synchronize_session=False)
        db.query(StudentRequest).filter(StudentRequest.id.in_(req_ids)).delete(synchronize_session=False)

    # 3. Delete objectives and glossary
    if objective_ids:
        db.query(Objective).filter(Objective.id.in_(objective_ids)).delete(synchronize_session=False)
    db.query(Glossary).filter(Glossary.unit_id == unit.id).delete(synchronize_session=False)
    db.flush()
    
    # 4. Delete unit
    db.delete(unit)
    db.commit()
    
    # 5. Source cleanup: if source is only attached to this unit, delete chunks, source pages, and source
    if source_id:
        other_units = db.query(Unit).filter(Unit.source_id == source_id).count()
        if other_units == 0:
            source = db.query(Source).filter(Source.id == source_id).first()
            if source:
                s_versions = db.query(SourceVersion).filter(SourceVersion.source_id == source.id).all()
                sv_ids = [sv.id for sv in s_versions]
                if sv_ids:
                    db.query(SourcePage).filter(
                        (SourcePage.source_id == source.id) | (SourcePage.source_version_id.in_(sv_ids))
                    ).delete(synchronize_session=False)
                    db.query(Chunk).filter(Chunk.source_version_id.in_(sv_ids)).delete(synchronize_session=False)
                    db.query(SourceVersion).filter(SourceVersion.id.in_(sv_ids)).delete(synchronize_session=False)
                else:
                    db.query(SourcePage).filter(SourcePage.source_id == source.id).delete(synchronize_session=False)
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

        # Grounded generation for supported objectives: ALL 7 DISTINCT ASSETS in parallel
        with ThreadPoolExecutor(max_workers=5) as executor:
            f_exp = executor.submit(generate_concept_explanation, obj.text, matched_chunks, glossary, obj.bloom_level, getattr(obj, "target_level", "Standard"))
            f_ex = executor.submit(generate_worked_example, obj.text, matched_chunks, glossary, "Apply")
            f_quiz = executor.submit(generate_formative_quiz, obj.text, matched_chunks, glossary, obj.bloom_level, num_questions=q_count, difficulty_mode=diff_mode)
            f_easy = executor.submit(generate_differentiated_practice, obj.text, matched_chunks, glossary, "easy")
            f_adv = executor.submit(generate_differentiated_practice, obj.text, matched_chunks, glossary, "advanced")
            
            exp_data = f_exp.result()
            ex_data = f_ex.result()
            quiz_data = f_quiz.result()
            easy_data = f_easy.result()
            adv_data = f_adv.result()

        key_data = generate_answer_key(obj.text, quiz_data, matched_chunks)
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
            
            if asset_type == "quiz":
                sync_quiz_items_for_asset(
                    db=db,
                    asset=asset,
                    content_data=content_data,
                    teacher_id=current_teacher.id,
                    regen_reason="Initial Generation",
                    regen_category="Initial Generation",
                    force_sync=False
                )
            
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

    if asset_type == "quiz":
        sync_quiz_items_for_asset(
            db=db,
            asset=asset,
            content_data=new_content,
            teacher_id=current_teacher.id,
            regen_reason="Full Quiz Asset Regeneration",
            regen_category="Full Quiz Regeneration",
            force_sync=True
        )
    
    return {
        "message": f"Regenerated {asset_type} as immutable Version {new_version_no}.",
        "asset_id": asset.id,
        "version_id": new_ver.id,
        "version_no": new_version_no,
        "content_json": new_content,
        "quality_flags_count": len(flags)
    }

@router.put("/asset-versions/{version_id}/inline-edit")
@router.post("/asset-versions/{version_id}/edit")
def inline_edit_asset(version_id: int, data: InlineEditAsset, db: Session = Depends(get_db), current_teacher: User = Depends(teacher_required)):
    ver = db.query(AssetVersion).filter(AssetVersion.id == version_id).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Asset version not found")
        
    if ver.status == "approved":
        raise HTTPException(status_code=400, detail="Approved versions are immutable. Please regenerate to create a new draft version.")
        
    ver.content_json = json.dumps(data.content_json)
    db.commit()
    
    asset = db.query(Asset).filter(Asset.id == ver.asset_id).first()
    if asset and asset.type == "quiz":
        sync_quiz_items_for_asset(
            db=db,
            asset=asset,
            content_data=data.content_json,
            teacher_id=current_teacher.id,
            regen_reason="Teacher Manual Edit",
            regen_category="Manual Edit",
            force_sync=True
        )
        
    return {"message": "Content updated successfully.", "version_id": ver.id, "version_no": ver.version_no}

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
# PER-QUESTION SELECTIVE REGENERATION & VERSIONING
# -------------------------------------------------------------
def sync_quiz_items_for_asset(
    db: Session,
    asset: Asset,
    content_data: dict,
    teacher_id: int = None,
    regen_reason: str = "Quiz Asset Regeneration",
    regen_category: str = "Full Quiz Regeneration",
    force_sync: bool = False
) -> list:
    """
    Synchronizes, auto-backfills, or creates new versions in QuizItem and QuizItemVersion records.
    When a quiz is regenerated (force_sync=True or new questions provided), increments version and stores version history.
    """
    if asset.type not in ["quiz", "practice_easy", "practice_advanced"]:
        return []
        
    questions = content_data.get("questions", [])
    if not questions:
        return []

    existing_items = db.query(QuizItem).filter(QuizItem.asset_id == asset.id).order_by(QuizItem.item_index.asc()).all()
    
    if existing_items and not force_sync:
        return existing_items

    latest_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == asset.id).order_by(AssetVersion.version_no.desc()).first()
    init_status = latest_ver.status if latest_ver and latest_ver.status in ["approved", "needs_revision"] else "draft"

    created_items = []
    
    # If no existing items at all -> Initial backfill
    if not existing_items:
        for idx, q in enumerate(questions):
            q_stem = q.get("question") or q.get("question_text") or q.get("stem") or f"Question {idx+1}"
            opts = q.get("options", {})
            corr = q.get("correct_option_id") or q.get("correct_option") or q.get("_correct_option") or "A"
            corr_text = q.get("correct_answer") or q.get("correct_answer_text") or opts.get(corr, "")
            rat = q.get("rationale") or q.get("explanation", "")
            diff = q.get("difficulty_tier", "Medium")
            bloom = q.get("bloom_level", "Understand")
            cit = q.get("source_citation") or q.get("citation", "")
            
            q_status = q.get("status", init_status)
            v_no = q.get("version_no", 1)
            
            item = QuizItem(
                asset_id=asset.id,
                item_index=idx,
                question_text=q_stem,
                options_json=json.dumps(opts),
                correct_option_id=str(corr).upper(),
                correct_answer_text=str(corr_text),
                rationale=rat,
                difficulty_tier=diff,
                bloom_level=bloom,
                source_citation=cit,
                status=q_status,
                current_version_no=v_no,
                approved_at=datetime.utcnow() if q_status == "approved" else None
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            
            item_ver = QuizItemVersion(
                quiz_item_id=item.id,
                version_no=v_no,
                question_text=q_stem,
                options_json=json.dumps(opts),
                correct_option_id=str(corr).upper(),
                correct_answer_text=str(corr_text),
                rationale=rat,
                difficulty_tier=diff,
                bloom_level=bloom,
                source_citation=cit,
                status=q_status,
                regen_reason=regen_reason or "Initial Generation",
                regen_reason_category=regen_category or "Initial Generation",
                triggered_by=teacher_id
            )
            db.add(item_ver)
            db.commit()
            created_items.append(item)
    else:
        # Existing items exist and force_sync is True (e.g. Regenerate Quiz was called)
        for idx, q in enumerate(questions):
            q_stem = q.get("question") or q.get("question_text") or q.get("stem") or f"Question {idx+1}"
            opts = q.get("options", {})
            corr = q.get("correct_option_id") or q.get("correct_option") or q.get("_correct_option") or "A"
            corr_text = q.get("correct_answer") or q.get("correct_answer_text") or opts.get(corr, "")
            rat = q.get("rationale") or q.get("explanation", "")
            diff = q.get("difficulty_tier", "Medium")
            bloom = q.get("bloom_level", "Understand")
            cit = q.get("source_citation") or q.get("citation", "")
            
            if idx < len(existing_items):
                item = existing_items[idx]
                new_v_no = (item.current_version_no or 1) + 1
                item.question_text = q_stem
                item.options_json = json.dumps(opts)
                item.correct_option_id = str(corr).upper()
                item.correct_answer_text = str(corr_text)
                item.rationale = rat
                item.difficulty_tier = diff
                item.bloom_level = bloom
                item.source_citation = cit
                item.status = "draft"
                item.current_version_no = new_v_no
                item.approved_at = None
                db.commit()
                db.refresh(item)
                
                item_ver = QuizItemVersion(
                    quiz_item_id=item.id,
                    version_no=new_v_no,
                    question_text=q_stem,
                    options_json=json.dumps(opts),
                    correct_option_id=str(corr).upper(),
                    correct_answer_text=str(corr_text),
                    rationale=rat,
                    difficulty_tier=diff,
                    bloom_level=bloom,
                    source_citation=cit,
                    status="draft",
                    regen_reason=regen_reason or "Full Quiz Regeneration",
                    regen_reason_category=regen_category or "Full Quiz Regeneration",
                    triggered_by=teacher_id
                )
                db.add(item_ver)
                db.commit()
                created_items.append(item)
            else:
                # Extra question added
                item = QuizItem(
                    asset_id=asset.id,
                    item_index=idx,
                    question_text=q_stem,
                    options_json=json.dumps(opts),
                    correct_option_id=str(corr).upper(),
                    correct_answer_text=str(corr_text),
                    rationale=rat,
                    difficulty_tier=diff,
                    bloom_level=bloom,
                    source_citation=cit,
                    status="draft",
                    current_version_no=1
                )
                db.add(item)
                db.commit()
                db.refresh(item)
                
                item_ver = QuizItemVersion(
                    quiz_item_id=item.id,
                    version_no=1,
                    question_text=q_stem,
                    options_json=json.dumps(opts),
                    correct_option_id=str(corr).upper(),
                    correct_answer_text=str(corr_text),
                    rationale=rat,
                    difficulty_tier=diff,
                    bloom_level=bloom,
                    source_citation=cit,
                    status="draft",
                    regen_reason=regen_reason or "Full Quiz Regeneration",
                    regen_reason_category=regen_category or "Full Quiz Regeneration",
                    triggered_by=teacher_id
                )
                db.add(item_ver)
                db.commit()
                created_items.append(item)
                
    return created_items or existing_items

@router.get("/assets/{asset_id}/quiz-items")
def get_asset_quiz_items(
    asset_id: int,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    unit = db.query(Unit).filter(Unit.id == asset.unit_id, Unit.teacher_id == current_teacher.id).first()
    if not unit:
        raise HTTPException(status_code=403, detail="Unauthorized access to this asset")
        
    latest_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == asset.id).order_by(AssetVersion.version_no.desc()).first()
    content_dict = json.loads(latest_ver.content_json) if latest_ver and latest_ver.content_json else {}
    
    # Auto-backfill / sync items if not yet present
    quiz_items = db.query(QuizItem).filter(QuizItem.asset_id == asset.id).order_by(QuizItem.item_index.asc()).all()
    if not quiz_items and content_dict.get("questions"):
        quiz_items = sync_quiz_items_for_asset(db, asset, content_dict, current_teacher.id)
        
    res = []
    for it in quiz_items:
        v_count = db.query(QuizItemVersion).filter(QuizItemVersion.quiz_item_id == it.id).count()
        if v_count == 0:
            base_ver = QuizItemVersion(
                quiz_item_id=it.id,
                version_no=it.current_version_no or 1,
                question_text=it.question_text,
                options_json=it.options_json,
                correct_option_id=it.correct_option_id,
                correct_answer_text=it.correct_answer_text,
                rationale=it.rationale,
                difficulty_tier=it.difficulty_tier,
                bloom_level=it.bloom_level,
                source_citation=it.source_citation,
                status=it.status or "draft",
                regen_reason="Initial Generation",
                regen_reason_category="Initial Generation",
                triggered_by=current_teacher.id
            )
            db.add(base_ver)
            db.commit()
            v_count = 1

        opts = json.loads(it.options_json) if it.options_json else {}
        res.append({
            "id": it.id,
            "asset_id": it.asset_id,
            "item_index": it.item_index,
            "question_text": it.question_text,
            "options": opts,
            "correct_option_id": it.correct_option_id,
            "correct_answer_text": it.correct_answer_text or opts.get(it.correct_option_id, ""),
            "rationale": it.rationale,
            "difficulty_tier": it.difficulty_tier,
            "bloom_level": it.bloom_level,
            "source_citation": it.source_citation,
            "status": it.status,
            "current_version_no": it.current_version_no,
            "versions_count": v_count,
            "version_count": v_count,
            "created_at": it.created_at,
            "approved_at": it.approved_at
        })
    return res

@router.post("/quiz-items/regenerate-selected")
def regenerate_selected_quiz_items(
    data: QuizItemSelectiveRegenRequest,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    raw_ids = data.item_ids or data.selected_item_ids or []
    if not raw_ids:
        raise HTTPException(status_code=400, detail="Please select at least one question to regenerate.")
        
    # 1. Resolve asset and ensure items are synced
    asset = None
    if data.asset_id:
        asset = db.query(Asset).filter(Asset.id == data.asset_id).first()
        if asset:
            latest_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == asset.id).order_by(AssetVersion.version_no.desc()).first()
            content_dict = json.loads(latest_ver.content_json) if latest_ver and latest_ver.content_json else {}
            sync_quiz_items_for_asset(db, asset, content_dict, current_teacher.id)

    # 2. Resolve target QuizItem records
    items = []
    numeric_ids = []
    for raw in raw_ids:
        if isinstance(raw, int) or (isinstance(raw, str) and raw.isdigit()):
            numeric_ids.append(int(raw))

    if numeric_ids:
        items.extend(db.query(QuizItem).filter(QuizItem.id.in_(numeric_ids)).all())

    # Fallback to index-based matching if strings like "synth-0" or "q1" were passed
    if len(items) < len(raw_ids) and asset:
        asset_items = db.query(QuizItem).filter(QuizItem.asset_id == asset.id).order_by(QuizItem.item_index.asc()).all()
        for raw in raw_ids:
            idx = None
            if isinstance(raw, str):
                if raw.startswith("synth-"):
                    try: idx = int(raw.replace("synth-", ""))
                    except: pass
                elif raw.startswith("q") and raw[1:].isdigit():
                    try: idx = int(raw[1:]) - 1
                    except: pass
            if idx is not None and 0 <= idx < len(asset_items):
                target_item = asset_items[idx]
                if target_item not in items:
                    items.append(target_item)

    if not items and asset:
        asset_items = db.query(QuizItem).filter(QuizItem.asset_id == asset.id).order_by(QuizItem.item_index.asc()).all()
        if asset_items:
            items = [asset_items[0]]

    if not items:
        raise HTTPException(status_code=404, detail="No matching question items found to regenerate.")
        
    first_asset = db.query(Asset).filter(Asset.id == items[0].asset_id).first()
    unit = db.query(Unit).filter(Unit.id == first_asset.unit_id, Unit.teacher_id == current_teacher.id).first()
    if not unit:
        raise HTTPException(status_code=403, detail="Unauthorized access to this unit.")
        
    source = db.query(Source).filter(Source.id == unit.source_id).first()
    latest_source_ver = db.query(SourceVersion).filter(SourceVersion.source_id == source.id).order_by(SourceVersion.version_no.desc()).first() if source else None
    chunk_recs = db.query(Chunk).filter(Chunk.source_version_id == latest_source_ver.id).order_by(Chunk.chunk_index.asc()).all() if latest_source_ver else []
    chunks = [{"id": c.id, "chunk_index": c.chunk_index, "text": c.text} for c in chunk_recs]
    
    glossary_recs = db.query(Glossary).filter(Glossary.unit_id == unit.id).all()
    glossary = [{"term": g.term, "canonical_wording": g.canonical_wording} for g in glossary_recs]
    
    # Process each asset involved (usually 1 asset)
    asset_ids = list(set([it.asset_id for it in items]))
    regenerated_details = []
    
    for a_id in asset_ids:
        asset = db.query(Asset).filter(Asset.id == a_id).first()
        all_asset_items = db.query(QuizItem).filter(QuizItem.asset_id == a_id).order_by(QuizItem.item_index.asc()).all()
        obj = db.query(Objective).filter(Objective.id == asset.objective_id).first() if asset.objective_id else db.query(Objective).filter(Objective.unit_id == unit.id).first()
        obj_text = obj.text if obj else unit.title
        
        target_items = [it for it in items if it.asset_id == a_id]
        
        for it in target_items:
            # Collect other questions to avoid duplicate generation
            other_questions = [other.question_text for other in all_asset_items if other.id != it.id]
            prev_opts = json.loads(it.options_json) if it.options_json else {}
            
            new_q = regenerate_single_quiz_item(
                previous_question=it.question_text,
                previous_options=prev_opts,
                previous_correct=it.correct_option_id,
                objective_text=obj_text,
                chunks=chunks,
                glossary=glossary,
                bloom_level=it.bloom_level or (obj.bloom_level if obj else "Understand"),
                difficulty_mode=it.difficulty_tier or "Medium",
                regen_reason_category=data.regen_reason_category,
                regen_reason_comment=data.regen_reason_comment or "",
                other_existing_questions=other_questions
            )
            
            # Bump version and set status to draft
            it.current_version_no += 1
            it.question_text = new_q["question"]
            it.options_json = json.dumps(new_q["options"])
            it.correct_option_id = new_q["correct_option_id"]
            it.correct_answer_text = new_q.get("correct_answer_text") or new_q.get("correct_answer")
            it.rationale = new_q.get("rationale")
            it.difficulty_tier = new_q.get("difficulty_tier", it.difficulty_tier)
            it.bloom_level = new_q.get("bloom_level", it.bloom_level)
            it.source_citation = new_q.get("source_citation", it.source_citation)
            it.status = "draft"
            it.approved_at = None
            
            # Add version record
            new_ver = QuizItemVersion(
                quiz_item_id=it.id,
                version_no=it.current_version_no,
                question_text=it.question_text,
                options_json=it.options_json,
                correct_option_id=it.correct_option_id,
                correct_answer_text=it.correct_answer_text,
                rationale=it.rationale,
                difficulty_tier=it.difficulty_tier,
                bloom_level=it.bloom_level,
                source_citation=it.source_citation,
                status="draft",
                regen_reason=data.regen_reason_comment,
                regen_reason_category=data.regen_reason_category,
                triggered_by=current_teacher.id
            )
            db.add(new_ver)
            db.commit()
            
            regenerated_details.append({
                "item_id": it.id,
                "item_index": it.item_index,
                "version_no": it.current_version_no,
                "question_text": it.question_text
            })
            
        # Synchronize latest AssetVersion content_json
        latest_asset_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == a_id).order_by(AssetVersion.version_no.desc()).first()
        if latest_asset_ver:
            content_dict = json.loads(latest_asset_ver.content_json) if latest_asset_ver.content_json else {}
            
            updated_questions = []
            for q_it in all_asset_items:
                opts = json.loads(q_it.options_json) if q_it.options_json else {}
                corr = q_it.correct_option_id
                corr_text = q_it.correct_answer_text or opts.get(corr, "")
                updated_questions.append({
                    "id": f"q{q_it.item_index+1}",
                    "quiz_item_id": q_it.id,
                    "question": q_it.question_text,
                    "question_text": q_it.question_text,
                    "options": opts,
                    "correct_option_id": corr,
                    "correct_option": corr,
                    "correct_answer": corr_text,
                    "_correct_option": corr,
                    "_correct_answer_text": corr_text,
                    "rationale": q_it.rationale,
                    "_rationale": q_it.rationale,
                    "difficulty_tier": q_it.difficulty_tier,
                    "bloom_level": q_it.bloom_level,
                    "source_citation": q_it.source_citation,
                    "_citation": q_it.source_citation,
                    "status": q_it.status,
                    "version_no": q_it.current_version_no
                })
                
            content_dict["questions"] = updated_questions
            # Reset parent asset version status to draft since items were regenerated
            latest_asset_ver.status = "draft"
            latest_asset_ver.content_json = json.dumps(content_dict)
            
            # Re-run Quality Guardrails on whole quiz (§5 & Testing requirement)
            flags = run_all_guardrails(
                asset_type=asset.type,
                content_json=content_dict,
                retrieved_chunks=chunks,
                requested_bloom_level=obj.bloom_level if obj else "Understand",
                objective_id=obj.id if obj else None
            )
            # Remove old flags and store updated flags
            db.query(QualityFlag).filter(QualityFlag.asset_version_id == latest_asset_ver.id).delete(synchronize_session=False)
            for f in flags:
                q_flag = QualityFlag(
                    asset_version_id=latest_asset_ver.id,
                    flag_type=f["flag_type"],
                    severity=f["severity"],
                    message=f["message"]
                )
                db.add(q_flag)
            db.commit()
            
    return {
        "message": f"Successfully regenerated {len(items)} question(s) with reason '{data.regen_reason_category}'.",
        "regenerated_count": len(items),
        "regenerated_items": regenerated_details
    }

@router.get("/quiz-items/{item_id}/history")
def get_quiz_item_history(
    item_id: int,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    item = db.query(QuizItem).filter(QuizItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Question item not found")
        
    asset = db.query(Asset).filter(Asset.id == item.asset_id).first()
    unit = db.query(Unit).filter(Unit.id == asset.unit_id, Unit.teacher_id == current_teacher.id).first()
    if not unit:
        raise HTTPException(status_code=403, detail="Unauthorized access to this question history")
        
    versions = db.query(QuizItemVersion).filter(QuizItemVersion.quiz_item_id == item_id).order_by(QuizItemVersion.version_no.desc()).all()
    if not versions:
        # Auto-create baseline version 1 if missing
        base_ver = QuizItemVersion(
            quiz_item_id=item.id,
            version_no=item.current_version_no or 1,
            question_text=item.question_text,
            options_json=item.options_json,
            correct_option_id=item.correct_option_id,
            correct_answer_text=item.correct_answer_text,
            rationale=item.rationale,
            difficulty_tier=item.difficulty_tier,
            bloom_level=item.bloom_level,
            source_citation=item.source_citation,
            status=item.status or "draft",
            regen_reason="Initial Generation",
            regen_reason_category="Initial Generation",
            triggered_by=current_teacher.id
        )
        db.add(base_ver)
        db.commit()
        db.refresh(base_ver)
        versions = [base_ver]

    res = []
    for v in versions:
        teacher_user = db.query(User).filter(User.id == v.triggered_by).first() if v.triggered_by else None
        opts = json.loads(v.options_json) if v.options_json else {}
        res.append({
            "id": v.id,
            "version_no": v.version_no,
            "question_text": v.question_text,
            "options": opts,
            "correct_option_id": v.correct_option_id,
            "correct_answer_text": v.correct_answer_text or opts.get(v.correct_option_id, ""),
            "rationale": v.rationale,
            "difficulty_tier": v.difficulty_tier,
            "bloom_level": v.bloom_level,
            "source_citation": v.source_citation,
            "status": v.status,
            "regen_reason": v.regen_reason,
            "regen_reason_category": v.regen_reason_category,
            "triggered_by": v.triggered_by,
            "triggered_by_name": teacher_user.name if teacher_user else "Instructor",
            "created_at": v.created_at
        })
    return {
        "quiz_item_id": item.id,
        "current_status": item.status,
        "history": res
    }

@router.put("/quiz-items/{item_id}")
@router.post("/quiz-items/{item_id}/edit")
def edit_quiz_item(
    item_id: int,
    data: QuizItemEditRequest,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    item = db.query(QuizItem).filter(QuizItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Question item not found")
        
    asset = db.query(Asset).filter(Asset.id == item.asset_id).first()
    unit = db.query(Unit).filter(Unit.id == asset.unit_id, Unit.teacher_id == current_teacher.id).first()
    if not unit:
        raise HTTPException(status_code=403, detail="Unauthorized access to this question")
        
    # Bump version
    new_v_no = (item.current_version_no or 1) + 1
    item.question_text = data.question_text.strip()
    item.options_json = json.dumps(data.options)
    item.correct_option_id = data.correct_option_id.strip().upper()
    corr_text = data.correct_answer_text or data.options.get(data.correct_option_id.strip().upper(), "")
    item.correct_answer_text = corr_text
    item.rationale = data.rationale
    item.difficulty_tier = data.difficulty_tier or "Medium"
    item.bloom_level = data.bloom_level or "Understand"
    if data.source_citation:
        item.source_citation = data.source_citation
    item.status = "draft"
    item.current_version_no = new_v_no
    item.approved_at = None
    db.commit()
    db.refresh(item)
    
    # Store into QuizItemVersion history
    new_item_ver = QuizItemVersion(
        quiz_item_id=item.id,
        version_no=new_v_no,
        question_text=item.question_text,
        options_json=item.options_json,
        correct_option_id=item.correct_option_id,
        correct_answer_text=item.correct_answer_text,
        rationale=item.rationale,
        difficulty_tier=item.difficulty_tier,
        bloom_level=item.bloom_level,
        source_citation=item.source_citation,
        status="draft",
        regen_reason=data.edit_reason or "Teacher Manual Edit",
        regen_reason_category="Teacher Manual Edit",
        triggered_by=current_teacher.id
    )
    db.add(new_item_ver)
    db.commit()
    
    # Sync with parent AssetVersion content_json
    all_items = db.query(QuizItem).filter(QuizItem.asset_id == asset.id).order_by(QuizItem.item_index.asc()).all()
    latest_asset_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == asset.id).order_by(AssetVersion.version_no.desc()).first()
    
    if latest_asset_ver:
        content_dict = json.loads(latest_asset_ver.content_json) if latest_asset_ver.content_json else {}
        updated_questions = []
        for q_it in all_items:
            opts = json.loads(q_it.options_json) if q_it.options_json else {}
            corr = q_it.correct_option_id
            c_text = q_it.correct_answer_text or opts.get(corr, "")
            updated_questions.append({
                "id": f"q{q_it.item_index+1}",
                "quiz_item_id": q_it.id,
                "question": q_it.question_text,
                "question_text": q_it.question_text,
                "options": opts,
                "correct_option_id": corr,
                "correct_option": corr,
                "correct_answer": c_text,
                "_correct_option": corr,
                "_correct_answer_text": c_text,
                "rationale": q_it.rationale,
                "_rationale": q_it.rationale,
                "difficulty_tier": q_it.difficulty_tier,
                "bloom_level": q_it.bloom_level,
                "source_citation": q_it.source_citation,
                "_citation": q_it.source_citation,
                "status": q_it.status,
                "version_no": q_it.current_version_no
            })
            
        content_dict["questions"] = updated_questions
        latest_asset_ver.status = "draft"
        latest_asset_ver.content_json = json.dumps(content_dict)
        db.commit()
        
    return {
        "message": f"Question #{item.item_index+1} updated and saved as Version {new_v_no}.",
        "id": item.id,
        "version_no": new_v_no,
        "question_text": item.question_text,
        "status": item.status
    }

@router.post("/quiz-items/{item_id}/status")
def update_quiz_item_status(
    item_id: int,
    data: QuizItemStatusUpdate,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    item = db.query(QuizItem).filter(QuizItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Question item not found")
        
    asset = db.query(Asset).filter(Asset.id == item.asset_id).first()
    unit = db.query(Unit).filter(Unit.id == asset.unit_id, Unit.teacher_id == current_teacher.id).first()
    if not unit:
        raise HTTPException(status_code=403, detail="Unauthorized access to this question")
        
    item.status = data.status
    if data.status == "approved":
        item.approved_at = datetime.utcnow()
    else:
        item.approved_at = None
        
    # Also update latest item version status
    latest_item_ver = db.query(QuizItemVersion).filter(QuizItemVersion.quiz_item_id == item.id).order_by(QuizItemVersion.version_no.desc()).first()
    if latest_item_ver:
        latest_item_ver.status = data.status
        
    db.commit()
    
    # Sync with parent AssetVersion content_json
    all_items = db.query(QuizItem).filter(QuizItem.asset_id == asset.id).order_by(QuizItem.item_index.asc()).all()
    latest_asset_ver = db.query(AssetVersion).filter(AssetVersion.asset_id == asset.id).order_by(AssetVersion.version_no.desc()).first()
    
    if latest_asset_ver:
        content_dict = json.loads(latest_asset_ver.content_json) if latest_asset_ver.content_json else {}
        questions = content_dict.get("questions", [])
        for q in questions:
            if q.get("quiz_item_id") == item.id or q.get("id") == f"q{item.item_index+1}":
                q["status"] = item.status
                
        all_approved = all(it.status == "approved" for it in all_items)
        if all_approved:
            latest_asset_ver.status = "approved"
            latest_asset_ver.approved_at = datetime.utcnow()
            latest_asset_ver.approved_by = current_teacher.id
        elif latest_asset_ver.status == "approved":
            latest_asset_ver.status = "draft"
            
        latest_asset_ver.content_json = json.dumps(content_dict)
        db.commit()
        
    return {
        "message": f"Question {item.item_index+1} marked as '{item.status}'.",
        "id": item.id,
        "status": item.status,
        "approved_at": item.approved_at
    }

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
        
    # Query student_requests where status IN ('open', 'in_progress') for Class Struggle Signals
    active_requests = db.query(StudentRequest).filter(
        StudentRequest.classroom_id == classroom.id,
        StudentRequest.status.in_(["open", "in_progress"])
    ).all()
    
    grouped_counts = {}
    general_count = 0
    for req in active_requests:
        if req.objective_id is None:
            general_count += 1
        else:
            obj_id = req.objective_id
            if obj_id not in grouped_counts:
                grouped_counts[obj_id] = 0
            grouped_counts[obj_id] += 1
            
    struggle_signals = []
    for obj_id, count in grouped_counts.items():
        obj = db.query(Objective).filter(Objective.id == obj_id).first()
        unit = db.query(Unit).filter(Unit.id == obj.unit_id).first() if obj else None
        has_warning = count >= 3
        struggle_signals.append({
            "objective_id": obj_id,
            "objective_text": obj.text if obj else f"Objective #{obj_id}",
            "unit_id": unit.id if unit else None,
            "unit_title": unit.title if unit else "",
            "request_count": count,
            "has_warning": has_warning,
            "warning_label": "⚠ Multiple students need help" if has_warning else None
        })
        
    struggle_signals.sort(key=lambda x: x["request_count"], reverse=True)

    return {
        "classroom_name": classroom.name,
        "total_enrolled": len(enrolled_students),
        "total_submissions": len(submissions),
        "enrolled_students": enrolled_students,
        "objective_alignment_map": alignment_map,
        "struggle_signals": {
            "signals": struggle_signals,
            "general_requests_count": general_count,
            "total_active_requests": len(active_requests)
        },
        "student_results": student_scores
    }


# ----------------------------------------------------------------------
# CLASS STRUGGLE SIGNALS & STUDENT REQUESTS ENDPOINTS
# ----------------------------------------------------------------------
@router.get("/classrooms/{classroom_id}/struggle-signals")
def get_classroom_struggle_signals(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id, Classroom.teacher_id == current_teacher.id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
        
    active_requests = db.query(StudentRequest).filter(
        StudentRequest.classroom_id == classroom.id,
        StudentRequest.status.in_(["open", "in_progress"])
    ).all()
    
    grouped_counts = {}
    general_count = 0
    
    for req in active_requests:
        if req.objective_id is None:
            general_count += 1
        else:
            obj_id = req.objective_id
            if obj_id not in grouped_counts:
                grouped_counts[obj_id] = 0
            grouped_counts[obj_id] += 1
            
    signals = []
    for obj_id, count in grouped_counts.items():
        obj = db.query(Objective).filter(Objective.id == obj_id).first()
        unit = db.query(Unit).filter(Unit.id == obj.unit_id).first() if obj else None
        has_warning = count >= 3
        signals.append({
            "objective_id": obj_id,
            "objective_text": obj.text if obj else f"Objective #{obj_id}",
            "unit_id": unit.id if unit else None,
            "unit_title": unit.title if unit else "",
            "request_count": count,
            "has_warning": has_warning,
            "warning_label": "⚠ Multiple students need help" if has_warning else None
        })
        
    signals.sort(key=lambda x: x["request_count"], reverse=True)
    
    return {
        "classroom_id": classroom.id,
        "classroom_name": classroom.name,
        "signals": signals,
        "general_requests_count": general_count,
        "total_active_requests": len(active_requests),
        "total_struggling_objectives": len(signals)
    }


@router.get("/classrooms/{classroom_id}/student-requests")
def get_classroom_student_requests(
    classroom_id: int,
    objective_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id, Classroom.teacher_id == current_teacher.id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
        
    query = db.query(StudentRequest).filter(StudentRequest.classroom_id == classroom.id)
    
    if objective_id is not None:
        query = query.filter(StudentRequest.objective_id == objective_id)
        
    if status:
        if status.lower() == "active":
            query = query.filter(StudentRequest.status.in_(["open", "in_progress"]))
        else:
            query = query.filter(StudentRequest.status == status.lower())
            
    requests_list = query.order_by(StudentRequest.created_at.desc()).all()
    
    res = []
    for r in requests_list:
        stu = db.query(User).filter(User.id == r.student_id).first()
        obj = db.query(Objective).filter(Objective.id == r.objective_id).first() if r.objective_id else None
        unit = db.query(Unit).filter(Unit.id == r.unit_id).first() if r.unit_id else (obj.unit if obj else None)
        
        responses = []
        for resp in r.responses:
            resp_user = db.query(User).filter(User.id == resp.user_id).first()
            responses.append({
                "id": resp.id,
                "user_id": resp.user_id,
                "user_name": resp_user.name if resp_user else "User",
                "user_role": resp_user.role if resp_user else "unknown",
                "message": resp.message,
                "created_at": resp.created_at.isoformat()
            })
            
        res.append({
            "id": r.id,
            "student_id": r.student_id,
            "student_name": stu.name if stu else "Unknown Student",
            "student_email": stu.email if stu else "",
            "classroom_id": r.classroom_id,
            "objective_id": r.objective_id,
            "objective_text": obj.text if obj else None,
            "unit_id": unit.id if unit else None,
            "unit_title": unit.title if unit else "",
            "question_text": r.question_text,
            "details": r.details,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "responses": responses
        })
        
    return res


@router.post("/student-requests/{request_id}/status")
def update_student_request_status(
    request_id: int,
    data: StudentRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    req = db.query(StudentRequest).filter(StudentRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    classroom = db.query(Classroom).filter(Classroom.id == req.classroom_id, Classroom.teacher_id == current_teacher.id).first()
    if not classroom:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    if data.status not in ["open", "in_progress", "resolved", "closed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    req.status = data.status
    db.commit()
    db.refresh(req)
    return {"id": req.id, "status": req.status, "message": f"Request status updated to {req.status}"}


@router.post("/student-requests/{request_id}/respond")
def respond_to_student_request(
    request_id: int,
    data: StudentRequestResponseCreate,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    req = db.query(StudentRequest).filter(StudentRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    classroom = db.query(Classroom).filter(Classroom.id == req.classroom_id, Classroom.teacher_id == current_teacher.id).first()
    if not classroom:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    if not data.message.strip():
        raise HTTPException(status_code=400, detail="Response message cannot be empty")
        
    response = RequestResponse(
        request_id=req.id,
        user_id=current_teacher.id,
        message=data.message.strip()
    )
    db.add(response)
    
    if req.status == "open":
        req.status = "in_progress"
        
    db.commit()
    db.refresh(response)
    return {"id": response.id, "request_id": req.id, "status": req.status, "message": "Response submitted"}


@router.get("/classrooms/{classroom_id}/objectives")
def get_classroom_objectives(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(teacher_required)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id, Classroom.teacher_id == current_teacher.id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
        
    units = db.query(Unit).filter(Unit.teacher_id == current_teacher.id).all()
    res = []
    for u in units:
        for o in u.objectives:
            res.append({
                "objective_id": o.id,
                "objective_text": o.text,
                "unit_id": u.id,
                "unit_title": u.title,
                "bloom_level": o.bloom_level
            })
    return res


