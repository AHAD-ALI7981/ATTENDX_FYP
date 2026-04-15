from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, Course
from schemas import CourseCreate, CourseResponse, RegisterRequest, UserResponse
from auth import require_role, hash_password

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.post("/courses", status_code=201)
def add_course(
    req: CourseCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin")),
):
    """Add a new course and assign a teacher to it."""
    # Find teacher by username
    teacher = db.query(User).filter(
        User.username == req.teacher_username, User.role == "teacher"
    ).first()
    if not teacher:
        raise HTTPException(404, f"Teacher '{req.teacher_username}' not found")

    course = Course(
        class_name=req.class_name,
        subject=req.subject,
        teacher_id=teacher.id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return {"message": "Course added successfully", "course_id": course.id}


@router.get("/courses", response_model=list[CourseResponse])
def get_all_courses(
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin")),
):
    """Get all courses with their assigned teacher info."""
    courses = db.query(Course).all()
    result = []
    for c in courses:
        teacher = db.query(User).filter(User.id == c.teacher_id).first()
        result.append(CourseResponse(
            id=c.id,
            class_name=c.class_name,
            subject=c.subject,
            teacher_name=teacher.username if teacher else "Unknown",
        ))
    return result


@router.post("/users", status_code=201)
def create_user(
    req: RegisterRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin")),
):
    """Admin-only endpoint to create Teacher or Student accounts."""
    if req.role not in ("teacher", "student", "admin"):
        raise HTTPException(400, "Role must be teacher, student, or admin")

    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(409, "Username already exists")

    new_user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        role=req.role,
    )
    db.add(new_user)
    db.commit()
    return {"message": f"User '{req.username}' created successfully as {req.role}"}


@router.get("/users", response_model=list[UserResponse])
def get_users(
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin")),
):
    """List all users for the admin dashboard."""
    return db.query(User).all()
