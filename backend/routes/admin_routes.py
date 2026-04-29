from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import math
import re

from database import get_db
from models import User, Course, Class, CourseDefinition
from schemas import (
    CourseCreate, CourseResponse, RegisterRequest, UserResponse,
    UserUpdateRequest, PaginatedUserResponse,
    ClassCreate, ClassResponse, CourseDefCreate, CourseDefResponse
)
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

    # Enforce strict username format (alphanumeric, dashes, underscores) to reliably act as student_id
    if not re.match(r"^[a-zA-Z0-9_-]+$", req.username):
        raise HTTPException(400, "Username can only contain letters, numbers, dashes, and underscores (no spaces).")

    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(409, "Username already exists")

    new_user = User(
        username=req.username,
        email=req.email,
        password_hash=hash_password(req.password),
        plain_password=req.password,
        role=req.role,
    )
    db.add(new_user)
    db.commit()
    return {"message": f"User '{req.username}' created successfully as {req.role}"}


@router.get("/users", response_model=PaginatedUserResponse)
def get_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    role: str = Query(None),
    search: str = Query(None),
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin")),
):
    """List users with pagination, searching, and filtering."""
    query = db.query(User).filter(User.username != "admin")
    
    if role and role != "all":
        query = query.filter(User.role == role)
        
    if search:
        search_term = f"%{search}%"
        query = query.filter((User.username.like(search_term)) | (User.email.like(search_term)))
        
    total = query.count()
    total_pages = math.ceil(total / limit)
    
    users = query.offset((page - 1) * limit).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "users": users
    }

@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    req: UserUpdateRequest,
    db: Session = Depends(get_db),
    admin_user: dict = Depends(require_role("admin")),
):
    """Admin endpoint to update a user's details."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(404, "User not found")
        
    if req.email is not None:
        # Check if email is already taken by someone else
        if req.email != target_user.email:
            existing = db.query(User).filter(User.email == req.email).first()
            if existing:
                raise HTTPException(409, "Email is already taken")
        target_user.email = req.email
        
    if req.role is not None:
        if req.role not in ("teacher", "student", "admin"):
            raise HTTPException(400, "Invalid role")
        target_user.role = req.role

    if req.password is not None:
        target_user.password_hash = hash_password(req.password)
        target_user.plain_password = req.password
        
    db.commit()
    return {"message": "User updated successfully"}

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: dict = Depends(require_role("admin")),
):
    """Admin endpoint to permanently delete a user."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(404, "User not found")
        
    if target_user.username == "admin":
        raise HTTPException(400, "Cannot delete the default admin account")
        
    db.delete(target_user)
    db.commit()
    return {"message": "User deleted successfully"}


# --- New Management Endpoints ---

@router.post("/classes", status_code=201)
def create_class(
    req: ClassCreate,
    db: Session = Depends(get_db),
    admin_user: dict = Depends(require_role("admin")),
):
    """Create a new class."""
    existing = db.query(Class).filter(Class.class_id == req.class_id).first()
    if existing:
        raise HTTPException(409, "Class ID already exists")
    
    new_class = Class(
        class_id=req.class_id,
        class_name=req.class_name,
        teacher_id=req.teacher_id
    )
    db.add(new_class)
    db.commit()
    return {"message": f"Class '{req.class_name}' created successfully"}

@router.get("/classes", response_model=list[ClassResponse])
def get_classes(
    db: Session = Depends(get_db),
    admin_user: dict = Depends(require_role("admin")),
):
    """List all classes with teacher names."""
    classes = db.query(Class).all()
    result = []
    for c in classes:
        teacher = db.query(User).filter(User.id == c.teacher_id).first() if c.teacher_id else None
        result.append(ClassResponse(
            id=c.id,
            class_id=c.class_id,
            class_name=c.class_name,
            teacher_id=c.teacher_id,
            teacher_name=teacher.username if teacher else None
        ))
    return result

@router.post("/course-defs", status_code=201)
def create_course_def(
    req: CourseDefCreate,
    db: Session = Depends(get_db),
    admin_user: dict = Depends(require_role("admin")),
):
    """Create a new course definition."""
    existing = db.query(CourseDefinition).filter(CourseDefinition.course_id == req.course_id).first()
    if existing:
        raise HTTPException(409, "Course ID already exists")
    
    new_course = CourseDefinition(
        course_id=req.course_id,
        course_description=req.course_description,
        credit_hours=req.credit_hours
    )
    db.add(new_course)
    db.commit()
    return {"message": f"Course '{req.course_id}' created successfully"}

@router.get("/course-defs", response_model=list[CourseDefResponse])
def get_course_defs(
    db: Session = Depends(get_db),
    admin_user: dict = Depends(require_role("admin")),
):
    """List all course definitions."""
    return db.query(CourseDefinition).all()
