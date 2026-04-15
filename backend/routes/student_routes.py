from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Course, Enrollment, Attendance
from schemas import StudentAttendanceResponse
from auth import require_role

router = APIRouter(prefix="/api/student", tags=["Student"])


@router.get("/courses")
def get_all_courses(
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("student")),
):
    """Get all available courses for the student dropdown."""
    courses = db.query(Course).all()
    return [
        {"id": c.id, "class_name": c.class_name, "subject": c.subject}
        for c in courses
    ]


@router.get("/attendance", response_model=StudentAttendanceResponse)
def check_attendance(
    student_id: str,
    course_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("student")),
):
    """Check attendance percentage for a student in a specific course."""
    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == student_id,
        Enrollment.course_id == course_id,
    ).first()

    if not enrollment:
        raise HTTPException(404, "Student not enrolled in this course")

    # Total classes = total unique attendance dates in this course
    all_enrollments = db.query(Enrollment).filter(Enrollment.course_id == course_id).all()
    all_ids = [e.id for e in all_enrollments]

    total_classes = db.query(Attendance.date).filter(
        Attendance.enrollment_id.in_(all_ids)
    ).distinct().count()

    present_count = db.query(Attendance).filter(
        Attendance.enrollment_id == enrollment.id,
        Attendance.status == "present",
    ).count()

    percentage = (present_count / total_classes * 100) if total_classes > 0 else 0.0

    return StudentAttendanceResponse(
        total_classes=total_classes,
        present=present_count,
        percentage=round(percentage, 1),
    )
