import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, Base, SessionLocal
from models import User
from auth import hash_password
from routes.auth_routes import router as auth_router
from routes.admin_routes import router as admin_router
from routes.teacher_routes import router as teacher_router
from routes.student_routes import router as student_router

# Create all database tables
Base.metadata.create_all(bind=engine)

# Inject a default admin on startup so we don't get locked out
with SessionLocal() as db:
    if not db.query(User).filter(User.username == "admin").first():
        db.add(User(username="admin", password_hash=hash_password("admin123"), role="admin"))
        db.add(User(username="teacher", password_hash=hash_password("teacher123"), role="teacher"))
        db.commit()
        print("Created default admin and teacher accounts.")

app = FastAPI(
    title="AI Attendance System",
    description="Facial Recognition Attendance System with FastAPI + MySQL",
    version="1.0.0",
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

from fastapi.responses import RedirectResponse

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
