import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from database import engine, Base, SessionLocal
from models import User
from auth import hash_password
from routes.auth_routes import router as auth_router
from routes.admin_routes import router as admin_router
from routes.teacher_routes import router as teacher_router
from routes.student_routes import router as student_router

# Create all database tables
Base.metadata.create_all(bind=engine)

# ---------- DB Migrations ----------
with SessionLocal() as db:
    # Migration: add email column to users
    try:
        db.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(100) UNIQUE"))
        db.commit()
        print("[Migration] Added email column to users table.")
    except Exception:
        db.rollback()

    # Migration: add user_id FK to enrollments
    try:
        db.execute(text("ALTER TABLE enrollments ADD COLUMN user_id INT NULL"))
        db.commit()
        print("[Migration] Added user_id column to enrollments table.")
    except Exception:
        db.rollback()

    # Migration: add class_ref_id FK to courses
    try:
        db.execute(text("ALTER TABLE courses ADD COLUMN class_ref_id INT NULL"))
        db.commit()
        print("[Migration] Added class_ref_id column to courses table.")
    except Exception:
        db.rollback()

    # Migration: add course_def_id FK to courses
    try:
        db.execute(text("ALTER TABLE courses ADD COLUMN course_def_id INT NULL"))
        db.commit()
        print("[Migration] Added course_def_id column to courses table.")
    except Exception:
        db.rollback()

    # Seed default admin account
    if not db.query(User).filter(User.username == "admin").first():
        db.add(User(username="admin", email="admin@example.com", password_hash=hash_password("admin123"), role="admin"))
        db.add(User(username="teacher", password_hash=hash_password("teacher123"), plain_password="teacher123", role="teacher"))
        db.commit()
        print("Created default admin and teacher accounts.")

# ---------- Rate Limiter ----------
limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])

app = FastAPI(
    title="AI Attendance System",
    description="Facial Recognition Attendance System with FastAPI + MySQL",
    version="1.0.0",
)

app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please slow down and try again shortly."},
    )

# CORS — allow frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(teacher_router)
app.include_router(student_router)

# Serve frontend static files (HTML, CSS, JS, images)
FRONTEND_DIR = Path(__file__).resolve().parent.parent
app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")

@app.get("/")
def read_root():
    """Automatically redirect root URL to the login page."""
    return RedirectResponse(url="/login.html")

app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "AI Attendance System is running"}
