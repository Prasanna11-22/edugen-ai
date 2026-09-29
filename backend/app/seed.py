import datetime
from sqlalchemy.orm import Session
from .models import User
from .auth import get_password_hash

def seed_database_if_empty(db: Session):
    """
    Seeds only the default Administrator account if not present.
    All other teachers and students are registered and created dynamically via the application.
    """
    admin = db.query(User).filter(User.role == "admin").first()
    if not admin:
        print("[DB Seeder] Creating default Admin account...")
        admin_user = User(
            role="admin",
            name="System Administrator",
            email="admin@gmail.com",
            password_hash=get_password_hash("admin@123"),
            is_approved=True
        )
        db.add(admin_user)
        db.commit()
        print("[DB Seeder] Default Admin account ready (admin@gmail.com).")
