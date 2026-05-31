<div align="center">

# 🎓 AttendX

### AI-Powered Face Recognition Attendance System

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://mysql.com)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.10-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org)
[![License](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

A modern, full-stack attendance management system that uses **facial recognition** to automate student attendance tracking. Built with FastAPI, OpenCV (YuNet + SFace), and a glassmorphism-styled frontend.

<img src="preview.png" alt="AttendX Login Preview" width="700" />

---

[Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [API Reference](#-api-reference) · [Architecture](#-architecture) · [Security](#-security)

</div>

---

## ✨ Features

### 🤖 AI-Powered Face Recognition
- **YuNet Face Detection** — Real-time, high-accuracy face detection using OpenCV's DNN module
- **SFace Face Recognition** — 128-dimensional face encoding extraction with cosine similarity matching
- **Anti-Spoofing** — Prevents duplicate face registration across different student accounts
- **Zero C++ Dependencies** — No dlib, CMake, or heavy build tools — models auto-download from HuggingFace

### 👨‍💼 Role-Based Dashboards

| Role | Capabilities |
|------|-------------|
| **Admin** | Create/manage users, define courses & classes, allot courses to teachers, full CRUD |
| **Teacher** | Enroll students with face data, mark attendance via face scan or manual entry, generate reports, download PDFs |
| **Student** | View enrolled courses, check personal attendance records, download attendance PDFs |

### 📋 Attendance Management
- **Face Scan Mode** — Teacher captures student's face via webcam → system auto-identifies and marks present
- **Manual Mode** — Bulk mark attendance for any date with present/absent toggles
- **Detailed Reports** — Per-student attendance percentage, shortage flags (<75%), exportable to PDF

### 🔐 Enterprise-Grade Security
- HttpOnly cookie-based JWT authentication (no `localStorage` tokens)
- Bcrypt password hashing with enforced strength rules
- Role-based access control on every endpoint
- Rate limiting on sensitive routes (login, face scan, enrollment)
- CORS origin whitelisting
- CSRF protection via SameSite cookies

---

## 🛠 Tech Stack

<table>
<tr>
<td align="center" width="50%">

### Backend
| Technology | Purpose |
|-----------|---------|
| **FastAPI** | High-performance async API framework |
| **SQLAlchemy** | ORM with relationship mapping & cascades |
| **MySQL** | Relational database with FK constraints |
| **PyMySQL** | Pure-Python MySQL driver |
| **OpenCV** | YuNet detection + SFace recognition |
| **NumPy / Pillow** | Image processing pipeline |
| **python-jose** | JWT token creation & validation |
| **Passlib + Bcrypt** | Secure password hashing |
| **SlowAPI** | Rate limiting middleware |
| **SMTP** | Email-based password reset |

</td>
<td align="center" width="50%">

### Frontend
| Technology | Purpose |
|-----------|---------|
| **HTML5** | Semantic page structure |
| **Vanilla CSS** | Custom glassmorphism design system |
| **Vanilla JavaScript** | Dashboard logic & API integration |
| **Remix Icons** | Beautiful iconography |
| **jsPDF** | Client-side PDF generation |
| **Webcam API** | Browser-native camera access |

</td>
</tr>
</table>

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **MySQL 8.0+** (with a database created)
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/attendx.git
cd attendx
```

### 2. Create & Activate Virtual Environment

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

> **Note:** OpenCV's ONNX face models (~5MB each) are **auto-downloaded** from HuggingFace on first run. No manual setup required.

### 4. Configure Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your actual values:

```env
# MySQL Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=attendance_db

# JWT Secret — generate a strong random key!
JWT_SECRET=your-super-secret-random-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24

# Default Admin Password (used only during initial DB seeding)
DEFAULT_ADMIN_PASSWORD=YourStrongAdminPass1

# Email (Optional — for password reset functionality)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Environment
ENVIRONMENT=development
```

### 5. Create the MySQL Database

```sql
CREATE DATABASE attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

### 6. Run the Server

```bash
cd backend
uvicorn main:app --reload
```

The app will be available at **http://127.0.0.1:8000**

### 7. Default Login

| Username | Password | Role |
|----------|----------|------|
| `admin` | *(value of `DEFAULT_ADMIN_PASSWORD` in `.env`)* | Admin |

> ⚠️ **Change the default admin password immediately after first login!**

---

## 🗺 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │ Login    │  │ Admin        │  │ Teacher / Student         │  │
│  │ Page     │  │ Dashboard    │  │ Dashboard                 │  │
│  └────┬─────┘  └──────┬───────┘  └─────────┬─────────────────┘  │
│       │               │                     │                    │
│       └───────────────┴─────────────────────┘                    │
│                        │  HttpOnly Cookies                       │
└────────────────────────┼────────────────────────────────────────┘
                         │
                    ┌────▼─────┐
                    │  FastAPI  │
                    │  Server   │
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
    │ Auth      │ │ Admin     │ │ Teacher/  │
    │ Routes    │ │ Routes    │ │ Student   │
    │           │ │           │ │ Routes    │
    └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
          │              │              │
          └──────────────┼──────────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
        ┌─────▼───┐ ┌───▼────┐ ┌──▼──────────┐
        │ MySQL   │ │ JWT    │ │ OpenCV      │
        │ (Data)  │ │ (Auth) │ │ YuNet+SFace │
        └─────────┘ └────────┘ └─────────────┘
```

### Database Schema

```
┌───────────┐       ┌────────────────┐       ┌──────────────────┐
│   users   │       │ course_defs    │       │     classes      │
│───────────│       │────────────────│       │──────────────────│
│ id (PK)   │       │ id (PK)        │       │ id (PK)          │
│ username  │       │ course_id      │       │ class_id         │
│ full_name │       │ description    │       │ class_name       │
│ email     │       │ credit_hours   │       │ teacher_id (FK)  │
│ password  │       └───────┬────────┘       └────────┬─────────┘
│ role      │               │                         │
│ class_id  │               │ CASCADE                 │ CASCADE
└─────┬─────┘               │                         │
      │              ┌──────▼─────────────────────────▼──┐
      │ CASCADE      │            courses                 │
      ├──────────────►│──────────────────────────────────│
      │              │ id (PK)                           │
      │              │ class_name, subject               │
      │              │ teacher_id (FK → users)           │
      │              │ class_ref_id (FK → classes)       │
      │              │ course_def_id (FK → course_defs)  │
      │              └──────────────┬─────────────────────┘
      │                             │ CASCADE
      │                    ┌────────▼────────┐
      │    CASCADE         │   enrollments   │
      ├───────────────────►│────────────────│
      │                    │ id (PK)         │
      │                    │ student_id      │
      │                    │ user_id (FK)    │
      │                    │ course_id (FK)  │
      │                    │ face_encoding   │
      │                    └───────┬─────────┘
      │                            │ CASCADE
      │                   ┌────────▼─────────┐
      │                   │   attendance     │
      │                   │─────────────────│
      │                   │ id (PK)          │
      │                   │ enrollment_id    │
      │                   │ date             │
      │                   │ status           │
      │                   │ marked_by        │
      │                   └──────────────────┘
```

---

## 📡 API Reference

All API endpoints are prefixed accordingly and documented via FastAPI's auto-generated docs at `/docs`.

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/login` | Login & set HttpOnly cookie | Public |
| `POST` | `/logout` | Clear auth cookie | Public |
| `GET` | `/me` | Get current user info | 🔒 Protected |
| `POST` | `/forgot-password` | Request password reset email | Public |
| `POST` | `/reset-password` | Reset password with token | Public |
| `POST` | `/update-password` | Change own password | 🔒 Protected |

### Admin (`/api/admin`) — Requires `admin` role

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/users` | List users (paginated, filterable) |
| `POST` | `/users` | Create teacher/student account |
| `PUT` | `/users/{id}` | Update user details |
| `DELETE` | `/users/{id}` | Delete user & cascade data |
| `GET/POST/DELETE` | `/classes` | CRUD for classes |
| `GET/POST/DELETE` | `/course-defs` | CRUD for course definitions |
| `GET/POST/DELETE` | `/courses` | Allot/manage course assignments |

### Teacher (`/api/teacher`) — Requires `teacher` role

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/my-courses` | Get assigned courses |
| `POST` | `/enroll` | Enroll student with face photo |
| `POST` | `/scan-face` | Mark attendance via face scan |
| `POST` | `/attendance/manual` | Bulk manual attendance |
| `GET` | `/attendance/{course_id}` | Daily attendance sheet |
| `GET` | `/report/{course_id}` | Student attendance report |
| `GET` | `/report-full/{course_id}` | Full report with metadata |

### Student (`/api/student`) — Requires `student` role

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/courses` | Get enrolled courses |
| `GET` | `/attendance/{course_id}` | Personal attendance details |

> 📝 **Interactive API Docs:** Visit `http://127.0.0.1:8000/docs` for Swagger UI.

---

## 📁 Project Structure

```
attendx/
├── backend/
│   ├── main.py              # FastAPI app entry point, migrations, CORS
│   ├── database.py          # SQLAlchemy engine & session config
│   ├── models.py            # ORM models (User, Course, Enrollment, etc.)
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── auth.py              # JWT, bcrypt, role-based auth
│   ├── face_utils.py        # YuNet + SFace face recognition pipeline
│   ├── email_utils.py       # SMTP email for password resets
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Environment variable template
│   ├── models/              # Auto-downloaded ONNX face models
│   └── routes/
│       ├── auth_routes.py   # Login, logout, password reset
│       ├── admin_routes.py  # User, class, course CRUD
│       ├── teacher_routes.py# Enrollment, face scan, reports
│       └── student_routes.py# Course view, attendance check
│
├── frontend/
│   ├── login.html           # Login page
│   ├── forgot-password.html # Password recovery
│   ├── reset-password.html  # Password reset form
│   ├── admindashboard.html  # Admin control panel
│   ├── teacherdashboard.html# Teacher workspace
│   ├── student_dashboard.html# Student portal
│   └── assets/
│       ├── css/
│       │   ├── styles.css       # Login page styles
│       │   └── dashboard.css    # Dashboard glassmorphism theme
│       ├── js/
│       │   ├── auth.js          # Auth flow & cookie management
│       │   ├── admin.js         # Admin dashboard logic
│       │   ├── teacher.js       # Teacher dashboard logic
│       │   ├── student.js       # Student dashboard logic
│       │   ├── toast.js         # Toast notification system
│       │   └── main.js          # Shared utilities
│       └── img/
│           └── login-bg.png     # Login background artwork
│
├── preview.png              # App preview screenshot
├── .gitignore
└── README.md
```

---

## 🔒 Security

AttendX is built with security as a first-class concern:

| Layer | Implementation |
|-------|---------------|
| **Authentication** | JWT tokens stored in `HttpOnly` cookies — inaccessible to JavaScript (prevents XSS token theft) |
| **Password Storage** | Bcrypt hashing with salt — never stored in plaintext |
| **Password Policy** | Minimum 8 chars, must include uppercase, lowercase, and digit |
| **Authorization** | Role-based middleware on every protected endpoint (`require_role()`) |
| **Rate Limiting** | SlowAPI limits on login (5/min), face scan (10/min), enrollment (10/min) |
| **CORS** | Strict origin whitelist — only configured frontend origins accepted |
| **CSRF** | `SameSite=Lax` cookie attribute prevents cross-site request forgery |
| **Input Validation** | Pydantic schemas with field constraints, regex patterns, and max lengths |
| **SQL Injection** | SQLAlchemy ORM parameterized queries — no raw SQL interpolation |
| **Token Scoping** | Reset tokens (`type: "reset"`) are explicitly rejected as access tokens |
| **Email Enumeration** | Forgot-password returns identical message whether email exists or not |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for educational institutions**

*AttendX — Making attendance smarter, one face at a time.*

</div>
