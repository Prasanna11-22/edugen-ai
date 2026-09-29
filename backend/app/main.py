from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base, SessionLocal
from .models import *
from .seed import seed_database_if_empty
from .routers import auth_router, admin_router, teacher_router, student_router, eval_router

# Initialize Tables
Base.metadata.create_all(bind=engine)

# Seed Database
try:
    with SessionLocal() as db:
        seed_database_if_empty(db)
except Exception as e:
    print(f"[Seed Warning] {e}")

app = FastAPI(
    title="LessonFoundry API",
    description="Teacher-Controlled Objective-Aligned RAG Learning Pack Studio",
    version="2.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(teacher_router.router)
app.include_router(student_router.router)
app.include_router(eval_router.router)

@app.get("/")
def root():
    return {
        "system": "LessonFoundry RAG Studio API",
        "status": "online",
        "theme": "Royal Black & Neon Orange",
        "database": "PostgreSQL Relational Storage",
        "version": "2.0.0"
    }

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "LessonFoundry API"}
