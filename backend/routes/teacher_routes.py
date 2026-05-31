from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from models import User, Course, Enrollment, Attendance, Class
from schemas import (
    EnrollRequest,
    FaceScanRequest,
    FaceScanResponse,
    ManualAttendanceRequest,
    DailyAttendanceItem,
    ReportItem,
)
from auth import require_role
from face_utils import get_face_encoding, encoding_to_json, json_to_encoding, match_face

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/teacher", tags=["Teacher"])


# ---------- Helper ----------
def _get_teacher(db: Session, username: str) -> User:
    teacher = db.query(User).filter(User.username == username, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(404, "Teacher not found")
    return teacher


def _verify_course_ownership(db: Session, course_id: int, teacher: User) -> Course:
    """Verify that the course belongs to this teacher. Raises 403 if not."""
    course = db.query(Course).filter(
        Course.id == course_id,
        Course.teacher_id == teacher.id
    ).first()
    if not course:
        raise HTTPException(403, "This course is not assigned to you")
    return course


# ---------- Courses ----------
@router.get("/my-courses")
def get_my_courses(
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("teacher")),
):
    """Get courses assigned to the logged-in teacher."""
    teacher = _get_teacher(db, user["sub"])
    courses = db.query(Course).filter(Course.teacher_id == teacher.id).all()
    teacher_name = teacher.full_name or teacher.username

    result = []
    for c in courses:
        credit_hours = 3
        course_code = c.subject
        course_description = ""
        if c.course_def:
            credit_hours = c.course_def.credit_hours or 3
            course_code = c.course_def.course_id or c.subject
            course_description = c.course_def.course_description or ""

        enrolled_count = db.query(Enrollment).filter(Enrollment.course_id == c.id).count()

        result.append({
            "id": c.id,
            "class_name": c.class_name,
            "subject": c.subject,
            "course_code": course_code,
            "course_description": course_description,
            "credit_hours": credit_hours,
            "teacher_name": teacher_name,
            "enrolled_count": enrolled_count,
        })

    return result


@router.get("/classes")
def get_teacher_classes(
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("teacher")),
):
    """Get all classes so teacher can filter students."""
    classes = db.query(Class).all()
    return [{"id": c.id, "class_name": c.class_name, "class_id": c.class_id} for c in classes]


# ---------- Available Students for Enrollment ----------
@router.get("/students-list")
def get_student_users(
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("teacher")),
):
    """Get all student user accounts for the enrollment dropdown."""
    students = db.query(User).filter(User.role == "student").all()
    return [
        {
            "id": s.id,
            "username": s.username,
            "full_name": s.full_name,
            "class_id": s.class_id
        }
        for s in students
    ]


# ---------- Enrollment with Face ----------
@router.post("/enroll")
@limiter.limit("10/minute")
def enroll_student(
    request: Request,
    req: EnrollRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("teacher")),
):
    """
    Enroll a student in a course with facial registration.
    Teacher selects a student from existing accounts and a course.
    """
    # Verify course belongs to this teacher
    teacher = _get_teacher(db, user["sub"])
    course = _verify_course_ownership(db, req.course_id, teacher)

    # Verify student exists in users table
    student_user = db.query(User).filter(User.id == req.student_user_id, User.role == "student").first()
    if not student_user:
        raise HTTPException(404, "Student account not found. Please ask admin to create the student account first.")

    # Check if already enrolled
    existing = db.query(Enrollment).filter(
        Enrollment.student_id == student_user.username,
        Enrollment.course_id == req.course_id,
    ).first()
    if existing:
        raise HTTPException(409, f"Student {student_user.username} is already enrolled in this course")

    # Extract face encoding from image
    encoding = get_face_encoding(req.face_image)
    if encoding is None:
        raise HTTPException(400, "No face detected in the image. Please try again with a clear face photo.")

    # Prevent face reuse — only check within this teacher's courses to limit data exposure
    teacher_course_ids = [c.id for c in db.query(Course).filter(Course.teacher_id == teacher.id).all()]
    teacher_enrollments = db.query(Enrollment).filter(
        Enrollment.course_id.in_(teacher_course_ids),
        Enrollment.face_encoding.isnot(None),
    ).all()

    known_encodings = []
    enrollment_refs = []
    
    for e in teacher_enrollments:
        if e.face_encoding:
            known_encodings.append(json_to_encoding(e.face_encoding))
            enrollment_refs.append(e)
            
    if known_encodings:
        match_idx = match_face(encoding, known_encodings)
        if match_idx != -1:
            matched_enrollment = enrollment_refs[match_idx]
            # It's fine if the SAME student is enrolling in a second course.
            # But if the student IDs (usernames) are different, someone is reusing a face.
            if matched_enrollment.student_id != student_user.username:
                raise HTTPException(409, f"This face is already registered to another student ({matched_enrollment.student_name}). Each person can only be registered to one account.")

    student_name = student_user.full_name or student_user.username

    # Save enrollment with face encoding, linked to user account
    enrollment = Enrollment(
        student_id=student_user.username,
        student_name=student_name,
        user_id=student_user.id,
        course_id=req.course_id,
        face_encoding=encoding_to_json(encoding),
    )
    db.add(enrollment)
    db.commit()
    return {"message": f"Student {student_name} enrolled successfully with face data"}


# ---------- Face Scan Attendance ----------
@router.post("/scan-face", response_model=FaceScanResponse)
@limiter.limit("10/minute")
def scan_face_attendance(
    request: Request,
    req: FaceScanRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("teacher")),
):
    """
    Scan a student's face to mark attendance.
    Compares the scanned face against all enrolled students in the course.
    If matched, marks as present for today.
    """
    teacher = _get_teacher(db, user["sub"])
    course = _verify_course_ownership(db, req.course_id, teacher)

    # Get scanned face encoding
    scanned_encoding = get_face_encoding(req.face_image)
    if scanned_encoding is None:
        return FaceScanResponse(matched=False, message="No face detected in the image. Please try again.")

    # Load only enrolled students with face data for this specific course
    enrollments = db.query(Enrollment).filter(
        Enrollment.course_id == req.course_id,
        Enrollment.face_encoding.isnot(None),
    ).all()

    if not enrollments:
        return FaceScanResponse(matched=False, message="No students enrolled with face data in this course.")

    known_encodings = [json_to_encoding(e.face_encoding) for e in enrollments]

    # Match face
    match_index = match_face(scanned_encoding, known_encodings)

    if match_index == -1:
        return FaceScanResponse(matched=False, message="Face not recognized. No matching student found.")

    matched_enrollment = enrollments[match_index]
    today = date.today()

    # Check if already marked today
    existing_record = db.query(Attendance).filter(
        Attendance.enrollment_id == matched_enrollment.id,
        Attendance.date == today,
    ).first()

    if existing_record:
        return FaceScanResponse(
            matched=True,
            student_id=matched_enrollment.student_id,
            student_name=matched_enrollment.student_name,
            message=f"{matched_enrollment.student_name} already marked {existing_record.status} today.",
        )

    # Mark present
    attendance = Attendance(
        enrollment_id=matched_enrollment.id,
        date=today,
        status="present",
        marked_by="face_scan",
    )
    db.add(attendance)
    db.commit()

    return FaceScanResponse(
        matched=True,
        student_id=matched_enrollment.student_id,
        student_name=matched_enrollment.student_name,
        message=f"✅ {matched_enrollment.student_name} ({matched_enrollment.student_id}) marked PRESENT via face scan.",
    )


# ---------- Manual Attendance ----------
@router.post("/attendance/manual")
def mark_manual_attendance(
    req: ManualAttendanceRequest,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("teacher")),
):
    """Mark attendance manually for multiple students."""
    teacher = _get_teacher(db, user["sub"])
    course = _verify_course_ownership(db, req.course_id, teacher)

    for record in req.records:
        enrollment = db.query(Enrollment).filter(
            Enrollment.student_id == record.student_id,
            Enrollment.course_id == req.course_id,
        ).first()
        if not enrollment:
            continue

        # Upsert: update if exists, create if not
        existing = db.query(Attendance).filter(
            Attendance.enrollment_id == enrollment.id,
            Attendance.date == req.date,
        ).first()

        if existing:
            existing.status = record.status
            existing.marked_by = "manual"
        else:
            att = Attendance(
                enrollment_id=enrollment.id,
                date=req.date,
                status=record.status,
                marked_by="manual",
            )
            db.add(att)

    db.commit()
    return {"message": f"Attendance saved for {len(req.records)} students"}


# ---------- Enrolled Students List ----------
@router.get("/students/{course_id}")
def get_enrolled_students(
    course_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("teacher")),
):
    """Get all enrolled students in a course (for manual attendance form)."""
    # Verify teacher owns this course
    teacher = _get_teacher(db, user["sub"])
    _verify_course_ownership(db, course_id, teacher)

    enrollments = db.query(Enrollment).filter(Enrollment.course_id == course_id).all()

    result = []
    for e in enrollments:
        # Always resolve latest name from User FK when available
        student_name = e.student_name
        if e.user_id:
            student_user = db.query(User).filter(User.id == e.user_id).first()
            if student_user:
                student_name = student_user.full_name or student_user.username

        result.append({"student_id": e.student_id, "student_name": student_name})

    return result


# ---------- Daily Attendance Sheet ----------
@router.get("/attendance/{course_id}", response_model=list[DailyAttendanceItem])
def get_daily_attendance(
    course_id: int,
    date: date,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("teacher")),
):
    """Get the attendance sheet for a specific course and date."""
    # Verify teacher owns this course
    teacher = _get_teacher(db, user["sub"])
    _verify_course_ownership(db, course_id, teacher)

    enrollments = db.query(Enrollment).filter(Enrollment.course_id == course_id).all()
    result = []
    for e in enrollments:
        record = db.query(Attendance).filter(
            Attendance.enrollment_id == e.id,
            Attendance.date == date,
        ).first()

        # Resolve latest student name from User FK
        student_name = e.student_name
        if e.user_id:
            student_user = db.query(User).filter(User.id == e.user_id).first()
            if student_user:
                student_name = student_user.full_name or student_user.username

        result.append(DailyAttendanceItem(
            student_id=e.student_id,
            student_name=student_name,
            status=record.status if record else "absent",
        ))
    return result


# ---------- Detailed Course Report ----------
@router.get("/report/{course_id}", response_model=list[ReportItem])
def get_course_report(
    course_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("teacher")),
):
    """Get detailed attendance report for all students in a course."""
    # Verify teacher owns this course
    teacher = _get_teacher(db, user["sub"])
    _verify_course_ownership(db, course_id, teacher)

    enrollments = db.query(Enrollment).filter(Enrollment.course_id == course_id).all()

    # Total unique dates with any attendance record in this course
    all_enrollment_ids = [e.id for e in enrollments]
    if not all_enrollment_ids:
        return []

    total_dates = db.query(Attendance.date).filter(
        Attendance.enrollment_id.in_(all_enrollment_ids)
    ).distinct().count()

    result = []
    for e in enrollments:
        present_count = db.query(Attendance).filter(
            Attendance.enrollment_id == e.id,
            Attendance.status == "present",
        ).count()

        percentage = (present_count / total_dates * 100) if total_dates > 0 else 0.0

        # Resolve latest student name from User FK
        student_name = e.student_name
        if e.user_id:
            student_user = db.query(User).filter(User.id == e.user_id).first()
            if student_user:
                student_name = student_user.full_name or student_user.username

        result.append(ReportItem(
            student_id=e.student_id,
            student_name=student_name,
            total_classes=total_dates,
            present=present_count,
            percentage=round(percentage, 1),
        ))

    return result


# ---------- Full Report with Metadata ----------
@router.get("/report-full/{course_id}")
def get_full_course_report(
    course_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("teacher")),
):
    """
    Get a comprehensive attendance report including course metadata,
    student attendance stats, and shortage flags (below 75%).
    """
    teacher = _get_teacher(db, user["sub"])
    course = _verify_course_ownership(db, course_id, teacher)

    # Get course metadata
    credit_hours = 3  # default
    course_code = course.subject
    if course.course_def:
        credit_hours = course.course_def.credit_hours or 3
        course_code = course.course_def.course_id or course.subject

    teacher_name = teacher.full_name or teacher.username

    # Calculate attendance stats
    enrollments = db.query(Enrollment).filter(Enrollment.course_id == course_id).all()
    all_enrollment_ids = [e.id for e in enrollments]

    total_dates = 0
    if all_enrollment_ids:
        total_dates = db.query(Attendance.date).filter(
            Attendance.enrollment_id.in_(all_enrollment_ids)
        ).distinct().count()

    students = []
    shortage_count = 0
    for e in enrollments:
        present_count = db.query(Attendance).filter(
            Attendance.enrollment_id == e.id,
            Attendance.status == "present",
        ).count()

        percentage = round((present_count / total_dates * 100), 1) if total_dates > 0 else 0.0
        is_short = percentage < 75.0

        if is_short:
            shortage_count += 1

        # Resolve latest student name from User FK
        student_name = e.student_name
        if e.user_id:
            student_user = db.query(User).filter(User.id == e.user_id).first()
            if student_user:
                student_name = student_user.full_name or student_user.username

        students.append({
            "student_id": e.student_id,
            "student_name": student_name,
            "total_classes": total_dates,
            "present": present_count,
            "absent": total_dates - present_count,
            "percentage": percentage,
            "is_short": is_short,
        })

    return {
        "meta": {
            "class_name": course.class_name,
            "course_code": course_code,
            "subject": course.subject,
            "credit_hours": credit_hours,
            "teacher_name": teacher_name,
            "total_classes": total_dates,
            "total_students": len(enrollments),
            "shortage_count": shortage_count,
            "report_date": str(date.today()),
        },
        "students": students,
    }
