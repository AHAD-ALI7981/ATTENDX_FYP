from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date
import re


# ---- Auth ----
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    full_name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)
    role: str  # admin, teacher, student
    class_id: Optional[int] = None

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v):
        if v is not None:
            pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            if not re.match(pattern, v):
                raise ValueError("Invalid email format")
        return v

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., max_length=100)

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v):
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Invalid email format")
        return v

class ResetPasswordRequest(BaseModel):
    token: str = Field(..., max_length=1000)
    new_password: str = Field(..., min_length=8, max_length=128)

class UpdatePasswordRequest(BaseModel):
    current_password: str = Field(..., max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    class_id: Optional[int] = None
    class_name: Optional[str] = None

    class Config:
        from_attributes = True

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=100)
    role: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    class_id: Optional[int] = None

class PaginatedUserResponse(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    users: List[UserResponse]

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


# ---- Classes ----
class ClassCreate(BaseModel):
    class_id: str = Field(..., min_length=1, max_length=20)
    class_name: str = Field(..., min_length=1, max_length=100)
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
    course_id: str = Field(..., min_length=1, max_length=20)
    course_description: Optional[str] = Field(None, max_length=500)
    credit_hours: int = Field(3, ge=1, le=12)

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
    teacher_username: str = Field(..., min_length=1, max_length=50)

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
    face_image: str = Field(..., max_length=5_000_000)  # ~3.7MB max image size


# ---- Teacher: Face Scan Attendance ----
class FaceScanRequest(BaseModel):
    course_id: int
    face_image: str = Field(..., max_length=5_000_000)  # ~3.7MB max image size


class FaceScanResponse(BaseModel):
    matched: bool
    student_id: Optional[str] = None
    student_name: Optional[str] = None
    message: str


# ---- Teacher: Manual Attendance ----
class AttendanceRecord(BaseModel):
    student_id: str = Field(..., min_length=1, max_length=50)
    status: str = Field(..., pattern=r"^(present|absent)$")


class ManualAttendanceRequest(BaseModel):
    course_id: int
    date: date
    records: List[AttendanceRecord] = Field(..., max_length=500)


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
    class_name: str
    subject: str
    teacher_name: str
    credit_hours: int
    total_classes: int
    present: int
    percentage: float
    records: List[dict] = []
