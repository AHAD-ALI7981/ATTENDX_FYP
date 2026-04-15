from sqlalchemy import Column, Integer, String, Enum, Text, Date, ForeignKey, TIMESTAMP, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum("admin", "teacher", "student", name="user_role"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relationship: teacher -> courses
    courses = relationship("Course", back_populates="teacher")


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    class_name = Column(String(100), nullable=False)
    subject = Column(String(100), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    teacher = relationship("User", back_populates="courses")
    enrollments = relationship("Enrollment", back_populates="course")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(String(20), nullable=False)
    student_name = Column(String(100), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    face_encoding = Column(Text, nullable=True)  # 128-dim vector as JSON string
    created_at = Column(TIMESTAMP, server_default=func.now())

    __table_args__ = (UniqueConstraint("student_id", "course_id", name="uq_student_course"),)

    course = relationship("Course", back_populates="enrollments")
    attendance_records = relationship("Attendance", back_populates="enrollment")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(Enum("present", "absent", name="attendance_status"), nullable=False)
    marked_by = Column(String(20), default="manual")  # 'manual' or 'face_scan'

    __table_args__ = (UniqueConstraint("enrollment_id", "date", name="uq_enrollment_date"),)

    enrollment = relationship("Enrollment", back_populates="attendance_records")
