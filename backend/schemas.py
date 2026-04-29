from pydantic import BaseModel
from typing import Optional, List
from datetime import date


# ---- Auth ----
class RegisterRequest(BaseModel):
    username: str
    email: Optional[str] = None
    password: str
    role: str  # admin, teacher, student

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    role: str
    plain_password: Optional[str] = None

    class Config:
        from_attributes = True

class UserUpdateRequest(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

class PaginatedUserResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    users: List[UserResponse]

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


# ---- Enrollment & Attendance ----
class EnrollmentCreate(BaseModel):
    student_id: str
    student_name: str
    course_id: int

class EnrollmentResponse(BaseModel):
    id: int
    student_id: str
    student_name: str
    course_id: int
    created_at: date

    class Config:
        from_attributes = True

# ---- New Management Schemas ----
class ClassCreate(BaseModel):
    class_id: str
    class_name: str
    teacher_id: Optional[int] = None

class ClassResponse(BaseModel):
    id: int
    class_id: str
    class_name: str
    teacher_id: Optional[int] = None
    teacher_name: Optional[str] = None

    class Config:
        from_attributes = True

class CourseDefCreate(BaseModel):
    course_id: str
    course_description: Optional[str] = None
    credit_hours: int = 3

class CourseDefResponse(BaseModel):
    id: int
    course_id: str
    course_description: Optional[str] = None
    credit_hours: int

    class Config:
        from_attributes = True


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
