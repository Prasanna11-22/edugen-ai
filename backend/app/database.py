import os
import socket
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

# PostgreSQL database URL with password 'admin'
POSTGRES_DEFAULT = "postgresql+psycopg2://postgres:admin@localhost:5432/lessonfoundry"
DATABASE_URL = os.getenv("DATABASE_URL", POSTGRES_DEFAULT)

def is_postgres_alive(host="localhost", port=5432, timeout=1.0) -> bool:
    """Check if PostgreSQL daemon is reachable."""
    try:
        sock = socket.create_connection((host, int(port)), timeout=timeout)
        sock.close()
        return True
    except:
        return False

engine = None

if DATABASE_URL.startswith("postgres"):
    host = "localhost"
    port = 5432
    try:
        parts = DATABASE_URL.split("@")[-1].split("/")[0]
        if ":" in parts:
            host, port = parts.split(":")
        else:
            host = parts
    except:
        pass
        
    if is_postgres_alive(host, int(port)):
        try:
            temp_engine = create_engine(DATABASE_URL, pool_pre_ping=True)
            with temp_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            engine = temp_engine
            print(f"[DB] Connected successfully to PostgreSQL at {host}:{port} (Database: lessonfoundry)")
        except Exception as e:
            print(f"[DB Warning] PostgreSQL connection error ({e}).")
            DATABASE_URL = "sqlite:///./lessonfoundry.db"
            engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    else:
        print(f"[DB Notice] PostgreSQL server not reachable on {host}:{port}.")
        DATABASE_URL = "sqlite:///./lessonfoundry.db"
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
