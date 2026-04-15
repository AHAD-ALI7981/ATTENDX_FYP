from pydantic import BaseModel
from typing import Optional, List
from datetime import date


# ---- Auth ----
class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str  # admin, teacher, student

class UserResponse(BaseModel):
    id: int
    username: str
    role: str

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


# ---- Admin: Courses ----
class CourseCreate(BaseModel):
    class_name: str
    subject: str
    teacher_username: str


class CourseResponse(BaseModel):
    id: int
    class_name: str
    subject: str
    teacher_name: str

    class Config:
        from_attributes = True


# ---- Teacher: Enrollment ----
class EnrollRequest(BaseModel):
    student_id: str
    student_name: str
    course_id: int
    face_image: str  # base64 encoded image


# ---- Teacher: Face Scan Attendance ----
class FaceScanRequest(BaseModel):
    course_id: int
    face_image: str  # base64 encoded image


class FaceScanResponse(BaseModel):
    matched: bool
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    message: str


# ---- Teacher: Manual Attendance ----
class AttendanceRecord(BaseModel):
    student_id: str
    status: str  # present or absent


class ManualAttendanceRequest(BaseModel):
    course_id: int
    date: date
    records: List[AttendanceRecord]


# ---- Teacher: Reports ----
class DailyAttendanceItem(BaseModel):
    student_id: str
    student_name: str
    status: str


class ReportItem(BaseModel):
    student_id: str
    student_name: str
    total_classes: int
    present: int
    percentage: float


# ---- Student ----
class StudentAttendanceResponse(BaseModel):
    total_classes: int
    present: int
    percentage: float
