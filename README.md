# Student Management System with Face Recognition

A comprehensive student-teacher management platform with advanced authentication, role-based access control, and facial recognition capabilities.

---

## Table of Contents
- [Functional Requirements](#functional-requirements)
- [Non-Functional Requirements](#non-functional-requirements)
- [Project Architecture](#project-architecture)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)

---

## Functional Requirements

### FR01: User Authentication

**FR01-01** System shall authenticate users via username and password.
- Users must provide valid credentials to access the system
- System shall validate credentials against the database
- System shall deny access if credentials are invalid

**FR01-02** System shall assign sessions using secure JWT tokens based on user roles.
- Upon successful authentication, system shall generate a JWT token
- Each user token shall contain role information (Admin, Teacher, Student)
- JWT tokens shall have an expiration time limit
- System shall validate JWT tokens for all protected endpoints

**FR01-03** System shall support multiple user roles with different access levels.
- Admin role: Full system access and user management capabilities
- Teacher role: Access to student records and attendance management
- Student role: Access to personal dashboard and profile information

---

### FR02: User Management (Admin)

**FR02-01** System shall allow the admin to add, update, and delete Teacher and Student accounts.
- Admin can create new user accounts with role assignment
- Admin can modify user information (name, email, username)
- Admin can deactivate or delete user accounts
- Admin can reset user passwords

**FR02-02** System shall prevent duplicate usernames or emails during registration.
- System shall validate uniqueness of username before account creation
- System shall validate uniqueness of email address before account creation
- System shall display error message if duplicate entry is attempted
- System shall provide suggestions for alternative usernames if needed

**FR02-03** System shall maintain audit logs for all user management operations.
- System shall record all admin actions (create, update, delete, password reset)
- Audit logs shall include timestamp and admin user information
- Admin can view audit logs for compliance and security purposes

---

### FR03: Password Management

**FR03-01** System shall allow users to reset forgotten passwords.
- System shall provide "Forgot Password" functionality on login page
- User shall receive password reset link via email
- Reset link shall be valid for 24 hours only
- System shall require new password confirmation

**FR03-02** System shall enforce password security policies.
- Passwords must be at least 8 characters long
- Passwords must contain uppercase, lowercase, numbers, and special characters
- System shall prevent reuse of last 5 passwords
- System shall prompt password change on first login or after 90 days

---

### FR04: Dashboard & User Interface

**FR04-01** System shall provide role-specific dashboards.
- Admin Dashboard: User management, statistics, audit logs, system analytics
- Teacher Dashboard: Student list, attendance records, grade management
- Student Dashboard: Personal profile, attendance records, grades, course information

**FR04-02** System shall display personalized information based on user role.
- Dashboard shall show current user's name and role
- Dashboard shall display relevant metrics (e.g., total students for teachers)
- Dashboard shall show recent activities or notifications

**FR04-03** System shall provide logout functionality.
- User can logout from any page
- Session shall be terminated immediately upon logout
- User shall be redirected to login page

---

### FR05: Facial Recognition & Authentication

**FR05-01** System shall capture and store facial data for user identification.
- System shall capture facial images during registration or profile setup
- Multiple facial images shall be captured to improve recognition accuracy
- System shall store facial embeddings securely (not raw images)

**FR05-02** System shall verify user identity using facial recognition.
- System can use face recognition as an alternative authentication method
- System shall match captured face against stored facial embeddings
- System shall require confirmation for successful match

**FR05-03** System shall handle facial recognition errors gracefully.
- System shall identify if no face is detected in the image
- System shall identify if multiple faces are detected
- System shall allow fallback to password authentication if face recognition fails

---

### FR06: Security Features

**FR06-01** System shall protect all API endpoints with authentication.
- All API endpoints shall require valid JWT token or session cookie
- Unauthenticated requests shall receive 401 Unauthorized response
- System shall log unauthorized access attempts

**FR06-02** System shall implement role-based access control (RBAC).
- Each endpoint shall verify user's role before granting access
- Unauthorized role access shall return 403 Forbidden response
- System shall log unauthorized role access attempts

**FR06-03** System shall implement CORS (Cross-Origin Resource Sharing) policies.
- System shall only accept requests from authorized domains
- Credentials shall be included in cross-origin requests when appropriate

---

### FR07: Email Notifications

**FR07-01** System shall send email notifications for password reset requests.
- Email shall contain secure password reset link
- Email shall include instructions for password reset process
- Email shall display link expiration time

**FR07-02** System shall send email notifications for account creation.
- New user shall receive welcome email with initial credentials
- Email shall include login instructions and system overview

---

## Non-Functional Requirements

### NFR01: Performance

**NFR01-01** The facial recognition module must process and verify a face within 3 seconds.
- Face detection shall complete in less than 1.5 seconds
- Face embedding generation shall complete in less than 1 second
- Face matching shall complete in less than 0.5 seconds

**NFR01-02** API response time for user authentication shall not exceed 2 seconds.
- Login endpoint shall respond within 2 seconds under normal load
- Token validation shall complete in less than 200 milliseconds
- Database queries shall complete within 500 milliseconds

**NFR01-03** Dashboard loading time shall not exceed 3 seconds.
- Initial page load shall complete within 3 seconds
- Data refresh operations shall complete within 2 seconds
- Pagination shall load within 1 second

---

### NFR02: Security

**NFR02-01** Passwords must be hashed using bcrypt with appropriate salt rounds.
- All passwords shall be hashed using bcrypt algorithm
- Salt rounds shall be minimum 10
- Plain text passwords shall never be stored or logged

**NFR02-02** API endpoints must be protected via HTTP-only cookies or JWT tokens.
- JWT tokens shall be stored in HTTP-only cookies for web clients
- Cookies shall have Secure flag set (HTTPS only)
- Cookies shall have SameSite=Strict attribute
- Token expiration shall be enforced (default 24 hours)

**NFR02-03** Sensitive data shall be encrypted at rest.
- Facial embeddings shall be encrypted in database
- Personal user information shall be encrypted in database
- Encryption keys shall be stored securely outside the codebase

**NFR02-04** All communications shall be conducted over HTTPS.
- System shall only accept HTTPS requests in production
- HTTP requests shall be redirected to HTTPS
- TLS certificates shall be valid and up-to-date

**NFR02-05** System shall implement rate limiting to prevent brute force attacks.
- Login attempts shall be limited to 5 attempts per 15 minutes per IP
- Password reset requests shall be limited to 3 per hour per email
- API endpoints shall have rate limiting based on user tier

**NFR02-06** System shall implement comprehensive logging and monitoring.
- All authentication attempts shall be logged with timestamp and IP
- Failed login attempts shall be logged and monitored
- Sensitive operations shall be logged for audit trails
- Logs shall not contain passwords or sensitive personal data

---

### NFR03: Reliability & Availability

**NFR03-01** System uptime shall be at least 99.5% during business hours.
- System shall be available 23.5 hours per day minimum
- Scheduled maintenance windows shall be announced in advance
- Database backups shall be performed daily

**NFR03-02** System shall handle concurrent users efficiently.
- System shall support minimum 100 concurrent users
- System shall degrade gracefully under high load
- Response times shall not increase exponentially with load

**NFR03-03** System shall implement data backup and recovery procedures.
- Database backups shall be performed daily
- Backups shall be stored in geographically separate location
- Recovery time objective (RTO) shall be less than 4 hours
- Recovery point objective (RPO) shall be less than 1 hour

---

### NFR04: Usability

**NFR04-01** User interface shall be intuitive and user-friendly.
- All critical functions shall be accessible within 3 clicks
- Navigation menu shall be consistent across all pages
- Error messages shall be clear and actionable

**NFR04-02** System shall support multiple browsers.
- System shall function on Chrome, Firefox, Safari, and Edge (latest versions)
- System shall be responsive on desktop, tablet, and mobile devices
- User experience shall be consistent across browsers

**NFR04-03** System shall provide clear feedback for all user actions.
- Loading indicators shall appear for long operations (>500ms)
- Success/error messages shall be displayed for all operations
- Form validation shall provide real-time feedback

---

### NFR05: Maintainability

**NFR05-01** Code shall follow consistent coding standards and best practices.
- Python code shall follow PEP 8 style guide
- JavaScript code shall use consistent naming conventions
- Code comments shall explain complex logic
- Functions shall have clear purposes and limited scope

**NFR05-02** System shall be modular and extensible.
- Code shall be organized into logical modules/components
- Core business logic shall be separate from UI logic
- APIs shall be versioned for backward compatibility

**NFR05-03** System shall have comprehensive documentation.
- API endpoints shall be documented with request/response examples
- Database schema shall be documented
- Installation and deployment procedures shall be documented
- Code comments shall explain non-obvious logic

---

### NFR06: Compatibility & Integration

**NFR06-01** System shall be compatible with major database systems.
- System shall support PostgreSQL/SQLite for data persistence
- Database migrations shall be version controlled

**NFR06-02** System shall integrate with email services.
- System shall support SMTP for email delivery
- Email delivery shall be asynchronous to prevent blocking

**NFR06-03** System shall support multiple facial recognition models.
- System shall support YuNet for face detection
- System shall support SFace for face recognition
- Models shall be easily replaceable with alternatives

---

### NFR07: Scalability

**NFR07-01** System architecture shall support horizontal scaling.
- Stateless authentication using JWT tokens
- Database should support replication
- Frontend resources should be cacheable

**NFR07-02** System shall handle large datasets efficiently.
- Queries shall be optimized with proper indexing
- Pagination shall be implemented for large result sets
- Database connections shall be pooled

---

### NFR08: Data Privacy & Compliance

**NFR08-01** System shall comply with data protection regulations.
- System shall follow GDPR principles for user data
- Users shall have right to access their personal data
- Users shall have right to request data deletion

**NFR08-02** System shall protect sensitive personal information.
- Email addresses shall be encrypted or obfuscated
- Student records shall be accessible only to authorized personnel
- Personal data shall be retained only as long as necessary

---

## Project Architecture

### Technology Stack

**Backend:**
- Python with FastAPI framework
- SQLAlchemy ORM for database operations
- Facial Recognition: YuNet (detection) + SFace (recognition)
- Authentication: JWT tokens with HTTP-only cookies

**Frontend:**
- HTML5, CSS3 (SCSS), JavaScript (Vanilla)
- Responsive design with mobile support
- Role-based UI components

**Database:**
- MySQL via SQLAlchemy ORM

**Deployment:**
- CORS-enabled API
- Email service integration (SMTP)

---

## Database Model

The backend database model is implemented with SQLAlchemy and includes these core tables:

- `users`
  - Stores all system users: `admin`, `teacher`, and `student`.
  - Key fields: `id`, `username`, `full_name`, `email`, `password_hash`, `role`, `created_at`.

- `classes`
  - Represents class groups or sections.
  - Fields: `id`, `class_id`, `class_name`, `teacher_id`.
  - Optional relationship to a teacher via `teacher_id`.

- `course_definitions`
  - Stores course metadata and credit hour details.
  - Fields: `id`, `course_id`, `course_description`, `credit_hours`.

- `courses`
  - Represents a specific course offering assigned to a class and teacher.
  - Fields: `id`, `class_name`, `subject`, `teacher_id`, `class_ref_id`, `course_def_id`.
  - Relationships link to `users` (teacher), `classes`, and `course_definitions`.

- `enrollments`
  - Stores student enrollments for each course.
  - Fields: `id`, `student_id`, `student_name`, `user_id`, `course_id`, `face_encoding`, `created_at`.
  - `user_id` references the student account in `users`.
  - Unique constraint ensures one enrollment per student per course.

- `attendance`
  - Stores attendance records tied to enrollments.
  - Fields: `id`, `enrollment_id`, `date`, `status`, `marked_by`.
  - `status` is `present` or `absent`.
  - Unique constraint ensures one record per student per date.

## Attendance Report Model

Reports are generated by aggregating data from `enrollments` and `attendance`:

- Teacher report endpoints compute `total_classes` using the number of distinct attendance dates for a course.
- `present` is the count of attendance records marked `present` for a student enrollment.
- `percentage` is calculated as `present / total_classes * 100` and rounded to one decimal place.

Teacher-facing report endpoints:

- `/api/teacher/report/{course_id}`
  - Returns a list of student attendance summaries.
  - Each item includes `student_id`, `student_name`, `total_classes`, `present`, and `percentage`.

- `/api/teacher/report-full/{course_id}`
  - Returns a full course report with metadata, student stats, and shortage flags.
  - Includes course details, total students, total classes, and `shortage_count`.
  - Each student entry contains `absent`, `percentage`, and `is_short` when below 75% attendance.

---

## Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js 14+ (if using build tools)
- PostgreSQL/SQLite

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### Frontend Setup
- Serve files from a local web server or deploy to hosting service

### Environment Variables
Create `.env` file in backend directory:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=attendance_db
JWT_SECRET_KEY=your_secret_key_here
JWT_ALGORITHM=HS256
EMAIL_ADDRESS=your_email@gmail.com
EMAIL_PASSWORD=your_app_password_here
```

---

## Usage

### Admin User
- Manage all users (create, update, delete)
- View system analytics and audit logs
- Configure system settings

### Teacher User
- View student list and records
- Mark attendance
- Manage grades and assignments

### Student User
- View personal dashboard
- Check attendance records
- View grades and course information

---

## Support & Documentation

For detailed API documentation, refer to the backend route files:
- `backend/routes/auth_routes.py` - Authentication endpoints
- `backend/routes/admin_routes.py` - Admin management endpoints
- `backend/routes/teacher_routes.py` - Teacher endpoints
- `backend/routes/student_routes.py` - Student endpoints

---

**Last Updated:** May 2026
