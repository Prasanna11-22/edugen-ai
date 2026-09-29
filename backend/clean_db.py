from app.database import engine, SessionLocal
from sqlalchemy import text
from app.models import User

with engine.connect() as conn:
    conn.execute(text("DELETE FROM submissions"))
    conn.execute(text("DELETE FROM quality_flags"))
    conn.execute(text("DELETE FROM assignments"))
    conn.execute(text("DELETE FROM asset_versions"))
    conn.execute(text("DELETE FROM assets"))
    conn.execute(text("DELETE FROM glossary"))
    conn.execute(text("DELETE FROM objectives"))
    conn.execute(text("DELETE FROM units"))
    conn.execute(text("DELETE FROM chunks"))
    conn.execute(text("DELETE FROM source_versions"))
    conn.execute(text("DELETE FROM sources"))
    conn.execute(text("DELETE FROM enrollments"))
    conn.execute(text("DELETE FROM classrooms"))
    
    # Keep admin and the teacher 717824p140@kce.ac.in
    conn.execute(text("""
        DELETE FROM users 
        WHERE email IN (
            'dr.sharma@university.edu', 
            'pending.prof@college.edu', 
            'rahul.verma@school.edu', 
            'priya.s@school.edu', 
            'amit.p@school.edu'
        )
    """))
    conn.commit()

db = SessionLocal()
print("PostgreSQL Database Purged. Current Active Users:")
for u in db.query(User).all():
    print(f" - [{u.role.upper()}] {u.email} ({u.name}) | Approved: {u.is_approved}")
db.close()
