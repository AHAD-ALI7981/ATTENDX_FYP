/**
 * teacher.js — Teacher dashboard logic.
 * Securely uses HttpOnly cookies via apiFetch.
 */

let selectedCourseId = null;
let enrollStream = null; 
let attendanceStream = null; 

document.addEventListener("DOMContentLoaded", async () => {
    const isAuthenticated = await requireAuth();
    if (!isAuthenticated) return;

    document.querySelector(".logout-btn").addEventListener("click", logout);
    const sidebarLogout = document.querySelector(".sidebar-logout");
    if(sidebarLogout) sidebarLogout.addEventListener("click", logout);

    // Tab switching logic
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all tabs and buttons
            navItems.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));

            // Add active class to clicked button and target tab
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            const targetTab = document.getElementById(targetId);
            if (targetTab) {
                targetTab.classList.add('active');
            }
        });
    });

    loadMyCourses();
    setupEnrollmentCamera();
    setupButtons();
});

// ==================== COURSES ====================
async function loadMyCourses() {
    try {
        const res = await apiFetch("/api/teacher/my-courses");
        if (!res.ok) return;

        const courses = await res.json();
        const container = document.getElementById("teacher-course-list");
        container.innerHTML = "";

        if (courses.length === 0) {
            container.innerHTML = '<p class="hint">No courses assigned yet. Ask admin to allot courses.</p>';
            return;
        }

        courses.forEach((c) => {
            const btn = document.createElement("button");
            btn.className = "secondary-btn";
            btn.textContent = `${c.class_name} — ${c.subject}`;
            btn.style.margin = "5px";
            btn.addEventListener("click", () => selectCourse(c.id, btn));
            container.appendChild(btn);
        });
    } catch (err) {
        console.error("Failed to load courses:", err);
    }
}

function selectCourse(courseId, btnElement) {
    selectedCourseId = courseId;
    document.querySelectorAll("#teacher-course-list .secondary-btn").forEach((b) => {
        b.style.background = "";
        b.style.color = "";
    });
    btnElement.style.background = "rgba(96, 165, 250, 0.3)";
    btnElement.style.color = "#fff";
    document.getElementById("teacher-actions-area").style.display = "block";
    loadEnrolledStudents();
}


// ==================== ENROLLMENT WITH FACE ====================
let capturedFaceBase64 = null;

function setupEnrollmentCamera() {
    const startBtn = document.getElementById("btn-start-enroll-cam");
    const captureBtn = document.getElementById("btn-capture-enroll-face");
    const video = document.getElementById("enroll-video");
    const statusText = document.getElementById("enroll-face-status");

    startBtn.addEventListener("click", async () => {
        try {
            enrollStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = enrollStream;
            video.classList.remove("hidden");
            captureBtn.classList.remove("hidden");
            startBtn.textContent = "Camera Active";
            startBtn.disabled = true;
        } catch (err) {
            alert("Unable to access camera. Please allow camera permissions.");
        }
    });

    captureBtn.addEventListener("click", () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        capturedFaceBase64 = canvas.toDataURL("image/jpeg").split(",")[1];

        statusText.textContent = "✅ Face captured successfully!";
        statusText.style.color = "#34d399";

        if (enrollStream) {
            enrollStream.getTracks().forEach((t) => t.stop());
        }
        video.classList.add("hidden");
        captureBtn.classList.add("hidden");
        startBtn.textContent = "Open Camera";
        startBtn.disabled = false;
    });
}

function setupButtons() {
    const enrollBtns = document.querySelectorAll(".action-btn");
    enrollBtns.forEach((btn) => {
        const text = btn.textContent.trim().toUpperCase();
        if (text === "COMPLETE ENROLLMENT") {
            btn.addEventListener("click", enrollStudent);
        } else if (text.includes("SCAN") && text.includes("FACE")) {
            btn.addEventListener("click", scanFace);
        } else if (text === "SAVE MANUAL ATTENDANCE") {
            btn.addEventListener("click", saveManualAttendance);
        } else if (text === "VIEW DAILY SHEET") {
            btn.addEventListener("click", viewDailySheet);
        } else if (text.includes("VIEW DETAILED")) {
            btn.addEventListener("click", viewDetailedReport);
        }
    });

    const reportBtn = document.querySelector(".secondary-btn");
    if (reportBtn && reportBtn.textContent.includes("View All Classes")) {
        reportBtn.addEventListener("click", viewAllClassesReport);
    }
}

async function enrollStudent() {
    if (!selectedCourseId) {
        alert("Please select a course first.");
        return;
    }
    const studentId = document.getElementById("enroll-student-id").value.trim();
    const studentName = document.getElementById("enroll-student-name").value.trim();

    if (!studentId || !studentName) {
        alert("Please enter Student ID and Name.");
        return;
    }
    if (!capturedFaceBase64) {
        alert("Please capture the student's face first.");
        return;
    }

    try {
        const res = await apiFetch("/api/teacher/enroll", {
            method: "POST",
            body: JSON.stringify({
                student_id: studentId,
                student_name: studentName,
                course_id: selectedCourseId,
                face_image: capturedFaceBase64,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Enrollment failed");
            return;
        }

        alert(data.message);
        document.getElementById("enroll-student-id").value = "";
        document.getElementById("enroll-student-name").value = "";
        capturedFaceBase64 = null;
        document.getElementById("enroll-face-status").textContent = "* Face Scan Required";
        document.getElementById("enroll-face-status").style.color = "red";

        loadEnrolledStudents();
    } catch (err) {
        console.error(err);
        alert("Server error during enrollment.");
    }
}


// ==================== FACE SCAN ATTENDANCE ====================
async function scanFace() {
    if (!selectedCourseId) {
        alert("Please select a course first.");
        return;
    }
    const video = document.getElementById("camera-stream");
    const resultText = document.getElementById("scan-result");

    if (!attendanceStream) {
        try {
            attendanceStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = attendanceStream;
        } catch (err) {
            alert("Unable to access camera.");
            return;
        }
    }

    await new Promise((r) => setTimeout(r, 500));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const faceImage = canvas.toDataURL("image/jpeg").split(",")[1];

    resultText.textContent = "🔍 Scanning...";
    resultText.style.color = "#60a5fa";

    try {
        const res = await apiFetch("/api/teacher/scan-face", {
            method: "POST",
            body: JSON.stringify({
                course_id: selectedCourseId,
                face_image: faceImage,
            }),
        });

        const data = await res.json();
        if (data.matched) {
            resultText.textContent = data.message;
            resultText.style.color = "#34d399";
        } else {
            resultText.textContent = data.message;
            resultText.style.color = "#f87171";
        }
    } catch (err) {
        console.error(err);
        resultText.textContent = "❌ Server error during scan.";
        resultText.style.color = "#f87171";
    }
}


// ==================== MANUAL ATTENDANCE ====================
async function loadEnrolledStudents() {
    if (!selectedCourseId) return;
    try {
        const res = await apiFetch(`/api/teacher/students/${selectedCourseId}`);
        if (!res.ok) return;

        const students = await res.json();
        const container = document.getElementById("manual-student-list");
        container.innerHTML = "";

        if (students.length === 0) {
            container.innerHTML = '<p class="hint">No students enrolled yet.</p>';
            return;
        }

        students.forEach((s) => {
            const div = document.createElement("div");
            div.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid rgba(255,255,255,0.1);";
            div.innerHTML = `
                <span>${s.student_name} (${s.student_id})</span>
                <select data-student-id="${s.student_id}" style="padding:6px 12px; border-radius:6px; background:rgba(255,255,255,0.15); color:#fff; border:1px solid rgba(255,255,255,0.2);">
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                </select>
            `;
            container.appendChild(div);
        });
    } catch (err) {
        console.error(err);
    }
}

async function saveManualAttendance() {
    if (!selectedCourseId) {
        alert("Please select a course first.");
        return;
    }
    const selects = document.querySelectorAll("#manual-student-list select");
    const records = [];
    selects.forEach((sel) => {
        records.push({
            student_id: sel.dataset.studentId,
            status: sel.value,
        });
    });

    if (records.length === 0) {
        alert("No students to mark attendance for.");
        return;
    }

    const today = new Date().toISOString().split("T")[0];

    try {
        const res = await apiFetch("/api/teacher/attendance/manual", {
            method: "POST",
            body: JSON.stringify({
                course_id: selectedCourseId,
                date: today,
                records: records,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Failed to save attendance");
            return;
        }
        alert(data.message);
    } catch (err) {
        console.error(err);
        alert("Server error saving attendance.");
    }
}


// ==================== REPORTS ====================
async function viewDailySheet() {
    if (!selectedCourseId) {
        alert("Please select a course first.");
        return;
    }
    const dateVal = document.getElementById("report-date-picker").value;
    if (!dateVal) {
        alert("Please select a date.");
        return;
    }

    try {
        const res = await apiFetch(`/api/teacher/attendance/${selectedCourseId}?date=${dateVal}`);
        if (!res.ok) return;

        const records = await res.json();
        const area = document.getElementById("teacher-report-area");
        area.innerHTML = generateTable(
            ["Student ID", "Name", "Status"],
            records.map((r) => [r.student_id, r.student_name, r.status.toUpperCase()])
        );
    } catch (err) {
        console.error(err);
    }
}

async function viewDetailedReport() {
    if (!selectedCourseId) {
        alert("Please select a course first.");
        return;
    }
    try {
        const res = await apiFetch(`/api/teacher/report/${selectedCourseId}`);
        if (!res.ok) return;

        const report = await res.json();
        const area = document.getElementById("teacher-report-area");
        area.innerHTML = generateTable(
            ["Student ID", "Name", "Total Classes", "Present", "Percentage"],
            report.map((r) => [r.student_id, r.student_name, r.total_classes, r.present, `${r.percentage}%`])
        );
    } catch (err) {
        console.error(err);
    }
}

async function viewAllClassesReport() {
    try {
        const res = await apiFetch("/api/teacher/my-courses");
        if (!res.ok) return;

        const courses = await res.json();
        let html = "";

        for (const c of courses) {
            const reportRes = await apiFetch(`/api/teacher/report/${c.id}`);
            if (!reportRes.ok) continue;

            const report = await reportRes.json();
            html += `<h4 style="margin:15px 0 5px; color:var(--white-soft);">${c.class_name} — ${c.subject}</h4>`;
            html += generateTable(
                ["Student ID", "Name", "Total", "Present", "%"],
                report.map((r) => [r.student_id, r.student_name, r.total_classes, r.present, `${r.percentage}%`])
            );
        }

        const area = document.getElementById("teacher-report-area");
        if (!area) {
            alert("Report loaded. Check the reports section below.");
            return;
        }
        area.innerHTML = html || '<p class="hint">No data available.</p>';
    } catch (err) {
        console.error(err);
    }
}


// ==================== HELPERS ====================
function generateTable(headers, rows) {
    let html = '<table><thead><tr>';
    headers.forEach((h) => (html += `<th>${h}</th>`));
    html += "</tr></thead><tbody>";
    rows.forEach((row) => {
        html += "<tr>";
        row.forEach((cell) => (html += `<td>${cell}</td>`));
        html += "</tr>";
    });
    html += "</tbody></table>";
    return html;
}
