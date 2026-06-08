from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
import math
import re

from database import get_db
from models import User, Course, Class, CourseDefinition, Enrollment
from schemas import (
    CourseCreate, CourseResponse, RegisterRequest, UserResponse,
    UserUpdateRequest, PaginatedUserResponse,
    ClassCreate, ClassResponse, CourseDefCreate, CourseDefResponse
)
from auth import require_role, hash_password, validate_password_strength

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ---------- Course Allotment ----------

@router.post("/courses", status_code=201)
def add_course(
    req: CourseCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin")),
):
    """Add a new course allotment: links a Class + CourseDefinition + Teacher."""
    # Find teacher by username
    teacher = db.query(User).filter(
        User.username == req.teacher_username, User.role == "teacher"
    ).first()
    if not teacher:
        raise HTTPException(404, f"Teacher '{req.teacher_username}' not found")

    # Validate Class exists
    class_ref = db.query(Class).filter(Class.id == req.class_ref_id).first()
    if not class_ref:
        raise HTTPException(404, "Selected class not found")

    # Validate CourseDefinition exists
    course_def = db.query(CourseDefinition).filter(CourseDefinition.id == req.course_def_id).first()
    if not course_def:
        raise HTTPException(404, "Selected course definition not found")

    # Check for duplicate allotment
    existing = db.query(Course).filter(
        Course.class_ref_id == req.class_ref_id,
        Course.course_def_id == req.course_def_id,
        Course.teacher_id == teacher.id,
    ).first()
    if existing:
        raise HTTPException(409, "This course is already allotted to this teacher for this class")

    course = Course(
        class_name=class_ref.class_name,
        subject=course_def.course_id,
        teacher_id=teacher.id,
        class_ref_id=class_ref.id,
        course_def_id=course_def.id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return {"message": "Course allotted successfully", "course_id": course.id}


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
        class_ref = db.query(Class).filter(Class.id == c.class_ref_id).first() if c.class_ref_id else None
        result.append(CourseResponse(
            id=c.id,
            class_name=class_ref.class_id if class_ref else c.class_name,
            subject=c.subject,
            teacher_name=(teacher.full_name or teacher.username) if teacher else "Unknown",
        ))
    return result


@router.delete("/courses/{course_id}")
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    admin_user: dict = Depends(require_role("admin")),
):
    """Delete a course allotment and all its enrollments/attendance."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(404, "Course not found")
    db.delete(course)
    db.commit()
    return {"message": "Course deleted successfully"}


# ---------- User Management ----------

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

    # Enforce strong password rules
    validate_password_strength(req.password)

    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(409, "Username already exists")

    new_user = User(
        username=req.username,
        full_name=req.full_name,
        email=req.email,
        password_hash=hash_password(req.password),
        role=req.role,
        class_id=req.class_id if req.role == "student" else None,
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
    total_pages = math.ceil(total / limit) if total > 0 else 1
    
    users = query.offset((page - 1) * limit).limit(limit).all()
    
    user_responses = []
    for u in users:
        class_name = None
        if u.class_id and u.class_ref:
            class_name = u.class_ref.class_id
        user_responses.append(UserResponse(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            email=u.email,
            role=u.role,
            class_id=u.class_id,
            class_name=class_name
        ))
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "users": user_responses
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
        
    if req.full_name is not None:
        target_user.full_name = req.full_name

    if req.role is not None:
        if req.role not in ("teacher", "student", "admin"):
            raise HTTPException(400, "Invalid role")
        target_user.role = req.role

    if req.class_id is not None:
        target_user.class_id = req.class_id if target_user.role == "student" else None

    if req.password is not None:
        validate_password_strength(req.password)
        target_user.password_hash = hash_password(req.password)
        
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


# ---------- Class Management ----------

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

@router.get("/classes/{class_id}/students")
def get_class_students(
    class_id: int,
    db: Session = Depends(get_db),
    admin_user: dict = Depends(require_role("admin")),
):
    """Get all students assigned to a specific class."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(404, "Class not found")

    students = db.query(User).filter(
        User.role == "student",
        User.class_id == class_id
    ).order_by(User.username).all()

    result = []
    for idx, s in enumerate(students, 1):
        result.append({
            "serial": idx,
            "id": s.id,
            "username": s.username,
            "full_name": s.full_name or "-",
        })

    return {
        "class_id": cls.class_id,
        "class_name": cls.class_name,
        "total_students": len(result),
        "students": result,
    }


@router.delete("/classes/{class_id}")
def delete_class(
    class_id: int,
    db: Session = Depends(get_db),
    admin_user: dict = Depends(require_role("admin")),
):
    """Delete a class and all its course allotments."""
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(404, "Class not found")
    # Delete all course allotments linked to this class (cascades to enrollments & attendance)
    related_courses = db.query(Course).filter(Course.class_ref_id == cls.id).all()
    for course in related_courses:
        db.delete(course)
    db.delete(cls)
    db.commit()
    return {"message": "Class deleted successfully"}


# ---------- Course Definition Management ----------

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

@router.delete("/course-defs/{course_def_id}")
def delete_course_def(
    course_def_id: int,
    db: Session = Depends(get_db),
    admin_user: dict = Depends(require_role("admin")),
):
    """Delete a course definition and all its course allotments."""
    cd = db.query(CourseDefinition).filter(CourseDefinition.id == course_def_id).first()
    if not cd:
        raise HTTPException(404, "Course definition not found")
    # Delete all course allotments linked to this definition (cascades to enrollments & attendance)
    related_courses = db.query(Course).filter(Course.course_def_id == cd.id).all()
    for course in related_courses:
        db.delete(course)
    db.delete(cd)
    db.commit()
    return {"message": "Course definition deleted successfully"}
