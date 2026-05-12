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


# ---- Classes ----
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


# ---- Course Definitions ----
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


# ---- Admin: Course Allotment ----
class CourseCreate(BaseModel):
    class_ref_id: int          # FK to classes table
    course_def_id: int         # FK to course_definitions table
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
    student_user_id: int       # FK to users table (student account)
    course_id: int
    face_image: str            # base64 encoded image


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
    student_id: str
    student_name: str
    total_classes: int
    present: int
    percentage: float
    records: List[dict] = []
