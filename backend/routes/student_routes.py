from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, Course, Enrollment, Attendance
from schemas import StudentAttendanceResponse
from auth import require_role

router = APIRouter(prefix="/api/student", tags=["Student"])


@router.get("/courses")
def get_enrolled_courses(
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("student")),
):
    """Get only the courses the logged-in student is enrolled in."""
    student_username = user["sub"]

    # Find enrollments for this student
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == student_username
    ).all()

    enrolled_course_ids = [e.course_id for e in enrollments]

    if not enrolled_course_ids:
        return []

    courses = db.query(Course).filter(Course.id.in_(enrolled_course_ids)).all()
    result = []
    for c in courses:
        course_code = c.course_def.course_id if c.course_def else c.subject
        course_description = c.course_def.course_description if c.course_def and c.course_def.course_description else ""
        result.append({
            "id": c.id,
            "class_name": c.class_name,
            "subject": c.subject,
            "course_code": course_code,
            "course_description": course_description,
            "teacher_name": (c.teacher.full_name or c.teacher.username) if c.teacher else "Unknown",
            "credit_hours": c.course_def.credit_hours if c.course_def else 3,
        })
    return result


@router.get("/attendance/{course_id}", response_model=StudentAttendanceResponse)
def check_attendance(
    course_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("student")),
):
    """Check attendance for the logged-in student in a specific course. Auto-detects student from JWT."""
    student_username = user["sub"]

    enrollment = db.query(Enrollment).filter(
        Enrollment.student_id == student_username,
        Enrollment.course_id == course_id,
    ).first()

    if not enrollment:
        raise HTTPException(404, "You are not enrolled in this course")

    # Total classes = total unique attendance dates in this course
    all_enrollments = db.query(Enrollment).filter(Enrollment.course_id == course_id).all()
    all_ids = [e.id for e in all_enrollments]

    # Get all distinct dates for this course where attendance was marked
    course_dates = db.query(Attendance.date).filter(
        Attendance.enrollment_id.in_(all_ids)
    ).distinct().order_by(Attendance.date.desc()).all()

    total_classes = len(course_dates)

    present_count = db.query(Attendance).filter(
        Attendance.enrollment_id == enrollment.id,
        Attendance.status == "present",
    ).count()

    percentage = (present_count / total_classes * 100) if total_classes > 0 else 0.0

    # Get the student's explicit attendance records
    student_records = db.query(Attendance).filter(
        Attendance.enrollment_id == enrollment.id
    ).all()

    # Map date to status
    status_by_date = {r.date: r.status for r in student_records}

    record_list = []
    for (d,) in course_dates:
        # If student has an explicit record, use it; otherwise, they are absent
        status = status_by_date.get(d, "absent")
        record_list.append({"date": str(d), "status": status})

    absent_count = total_classes - present_count

    # Resolve latest student name from User FK
    student_name = enrollment.student_name
    if enrollment.user_id:
        student_user = db.query(User).filter(User.id == enrollment.user_id).first()
        if student_user:
            student_name = student_user.full_name or student_user.username

    return StudentAttendanceResponse(
        student_id=enrollment.student_id,
        student_name=student_name,
        class_name=enrollment.course.class_name,
        subject=enrollment.course.subject,
        teacher_name=(enrollment.course.teacher.full_name or enrollment.course.teacher.username) if enrollment.course.teacher else "Unknown",
        credit_hours=enrollment.course.course_def.credit_hours if enrollment.course.course_def else 3,
        total_classes=total_classes,
        present=present_count,
        percentage=round(percentage, 1),
        records=record_list,
    )
