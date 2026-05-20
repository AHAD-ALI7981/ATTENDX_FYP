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
    loadStudentsList();
    setupEnrollmentCamera();
    setupButtons();

    // Setup event listener for the Mark Attendance dropdown
    const markAttendanceSelect = document.getElementById("mark-attendance-course-select");
    if (markAttendanceSelect) {
        markAttendanceSelect.addEventListener("change", (e) => {
            selectedCourseId = e.target.value;
            loadEnrolledStudents();
        });
    }
});

// ==================== COURSES ====================
async function loadMyCourses() {
    try {
        const res = await apiFetch("/api/teacher/my-courses");
        if (!res.ok) return;

        const courses = await res.json();
        const container = document.getElementById("teacher-course-list");
        container.innerHTML = "";

        // Populate enroll course and mark attendance dropdowns
        const enrollSelect = document.getElementById("enroll-course-select");
        const markAttendanceSelect = document.getElementById("mark-attendance-course-select");
        const reportSelect = document.getElementById("report-course-select");
        
        if (enrollSelect) {
            enrollSelect.innerHTML = '<option value="" disabled selected>Select Course</option>';
        }
        if (markAttendanceSelect) {
            markAttendanceSelect.innerHTML = '<option value="" disabled selected>Select Course</option>';
        }
        if (reportSelect) {
            reportSelect.innerHTML = '<option value="" disabled selected>Select Course...</option>';
        }
        
        courses.forEach((c) => {
            if (enrollSelect) {
                const opt = document.createElement("option");
                opt.value = c.id;
                opt.textContent = `${c.class_name} — ${c.subject}`;
                enrollSelect.appendChild(opt);
            }
            if (markAttendanceSelect) {
                const opt = document.createElement("option");
                opt.value = c.id;
                opt.textContent = `${c.class_name} — ${c.subject}`;
                markAttendanceSelect.appendChild(opt);
            }
            if (reportSelect) {
                const opt = document.createElement("option");
                opt.value = c.id;
                opt.textContent = `${c.class_name} — ${c.subject}`;
                reportSelect.appendChild(opt);
            }
        });

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
    loadEnrolledStudents();
}


// ==================== STUDENTS LIST ====================
async function loadStudentsList() {
    try {
        const res = await apiFetch("/api/teacher/students-list");
        if (!res.ok) return;

        const students = await res.json();
        const select = document.getElementById("enroll-student-select");
        if (!select) return;

        select.innerHTML = '<option value="" disabled selected>Select Student</option>';
        students.forEach((s) => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = s.full_name || s.username;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load students list:", err);
    }
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
        }
    });

    // Report buttons
    const generateBtn = document.getElementById("btn-generate-report");
    if (generateBtn) generateBtn.addEventListener("click", generateFullReport);

    const downloadBtn = document.getElementById("btn-download-pdf");
    if (downloadBtn) downloadBtn.addEventListener("click", downloadPDF);

    const reportBtn = document.querySelector(".secondary-btn");
    if (reportBtn && reportBtn.textContent.includes("View All Classes")) {
        reportBtn.addEventListener("click", viewAllClassesReport);
    }
}

async function enrollStudent() {
    const enrollCourseSelect = document.getElementById("enroll-course-select");
    const enrollCourseId = enrollCourseSelect ? enrollCourseSelect.value : null;
    if (!enrollCourseId) {
        alert("Please select a course first.");
        return;
    }

    const enrollStudentSelect = document.getElementById("enroll-student-select");
    const studentUserId = enrollStudentSelect ? enrollStudentSelect.value : null;
    if (!studentUserId) {
        alert("Please select a student.");
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
                student_user_id: parseInt(studentUserId),
                course_id: parseInt(enrollCourseId),
                face_image: capturedFaceBase64,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Enrollment failed");
            return;
        }

        alert(data.message);
        if (enrollCourseSelect) enrollCourseSelect.selectedIndex = 0;
        if (enrollStudentSelect) enrollStudentSelect.selectedIndex = 0;
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
        alert("Please select a course first from My Courses.");
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
        alert("Please select a course first from My Courses.");
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
let lastReportData = null; // stores last fetched report for PDF download

async function generateFullReport() {
    const courseSelect = document.getElementById("report-course-select");
    const courseId = courseSelect ? courseSelect.value : null;

    if (!courseId) {
        alert("Please select a course to generate a report.");
        return;
    }

    const btn = document.getElementById("btn-generate-report");
    btn.disabled = true;
    btn.textContent = "Generating...";

    try {
        const res = await apiFetch(`/api/teacher/report-full/${courseId}`);
        if (!res.ok) {
            const err = await res.json();
            alert(err.detail || "Failed to generate report");
            return;
        }

        const data = await res.json();
        lastReportData = data;
        const meta = data.meta;
        const students = data.students;

        // Fill stat cards
        document.getElementById("stat-total-classes").textContent = meta.total_classes;
        document.getElementById("stat-total-students").textContent = meta.total_students;
        document.getElementById("stat-credit-hours").textContent = meta.credit_hours;
        document.getElementById("stat-shortage").textContent = meta.shortage_count;

        // Fill metadata bar
        document.getElementById("meta-class").textContent = meta.class_name;
        document.getElementById("meta-course").textContent = meta.course_code && meta.course_code !== meta.subject
            ? `${meta.course_code} — ${meta.subject}`
            : meta.subject;
        document.getElementById("meta-teacher").textContent = meta.teacher_name;
        document.getElementById("meta-date").textContent = meta.report_date;

        // Show summary area
        document.getElementById("report-summary-area").style.display = "block";

        // Build report table with shortage highlighting
        const area = document.getElementById("teacher-report-area");

        if (students.length === 0) {
            area.innerHTML = '<p class="hint" style="text-align:center; padding: 20px;">No enrolled students found for this course.</p>';
            return;
        }

        let html = '<table><thead><tr>';
        html += '<th>#</th><th>Student ID</th><th>Name</th><th>Present</th><th>Absent</th><th>Total</th><th>Percentage</th><th>Status</th>';
        html += '</tr></thead><tbody>';

        students.forEach((s, i) => {
            const rowBg = s.is_short ? 'background: rgba(248, 113, 113, 0.08);' : '';
            const pctColor = s.is_short ? '#f87171' : '#34d399';
            const badge = s.is_short
                ? '<span style="background: rgba(248,113,113,0.2); color: #f87171; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.5px;">SHORTAGE</span>'
                : '<span style="background: rgba(52,211,153,0.2); color: #34d399; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.5px;">OK</span>';

            html += `<tr style="${rowBg}">`;
            html += `<td>${i + 1}</td>`;
            html += `<td>${s.student_id}</td>`;
            html += `<td>${s.student_name}</td>`;
            html += `<td style="color: #34d399; font-weight: 500;">${s.present}</td>`;
            html += `<td style="color: #f87171; font-weight: 500;">${s.absent}</td>`;
            html += `<td>${s.total_classes}</td>`;
            html += `<td style="color: ${pctColor}; font-weight: 600;">${s.percentage}%</td>`;
            html += `<td>${badge}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';

        // Shortage summary at the bottom
        if (meta.shortage_count > 0) {
            html += `<div style="margin-top: 15px; padding: 12px 16px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); border-radius: 8px; color: #fca5a5; font-size: 0.9rem;">
                <i class="ri-error-warning-line" style="margin-right: 5px;"></i>
                <strong>${meta.shortage_count} student(s)</strong> have attendance below 75% threshold.
            </div>`;
        }

        area.innerHTML = html;

    } catch (err) {
        console.error("Report generation error:", err);
        alert("Server error generating report.");
    } finally {
        btn.disabled = false;
        btn.textContent = "Generate Report";
    }
}


// ==================== PDF DOWNLOAD ====================
function downloadPDF() {
    if (!lastReportData) {
        alert("Please generate a report first.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("landscape", "mm", "a4");
    const meta = lastReportData.meta;
    const students = lastReportData.students;

    const pageWidth = doc.internal.pageSize.getWidth();

    // ---- Header Bar ----
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 32, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("AttendX — Attendance Report", 14, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${meta.report_date}`, pageWidth - 14, 15, { align: "right" });

    // ---- Course Metadata ----
    let yPos = 42;
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");

    const metaItems = [
        [`Class: ${meta.class_name}`, `Course: ${meta.course_code} — ${meta.subject}`],
        [`Teacher: ${meta.teacher_name}`, `Credit Hours: ${meta.credit_hours}`],
        [`Total Classes: ${meta.total_classes}`, `Total Students: ${meta.total_students}`],
    ];

    metaItems.forEach(pair => {
        doc.setFont("helvetica", "normal");
        doc.text(pair[0], 14, yPos);
        doc.text(pair[1], pageWidth / 2 + 14, yPos);
        yPos += 6;
    });

    // Shortage warning
    if (meta.shortage_count > 0) {
        yPos += 2;
        doc.setTextColor(220, 50, 50);
        doc.setFont("helvetica", "bold");
        doc.text(`⚠ ${meta.shortage_count} student(s) below 75% attendance threshold`, 14, yPos);
        doc.setTextColor(40, 40, 40);
        yPos += 4;
    }

    yPos += 4;

    // ---- Student Table ----
    const tableHeaders = [["#", "Student ID", "Name", "Present", "Absent", "Total", "%", "Status"]];
    const tableRows = students.map((s, i) => [
        i + 1,
        s.student_id,
        s.student_name,
        s.present,
        s.absent,
        s.total_classes,
        `${s.percentage}%`,
        s.is_short ? "SHORTAGE" : "OK",
    ]);

    doc.autoTable({
        head: tableHeaders,
        body: tableRows,
        startY: yPos,
        theme: "grid",
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 9,
            halign: "center",
        },
        bodyStyles: {
            fontSize: 9,
            halign: "center",
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250],
        },
        didParseCell: function (data) {
            // Color the status column
            if (data.section === "body" && data.column.index === 7) {
                if (data.cell.raw === "SHORTAGE") {
                    data.cell.styles.textColor = [220, 50, 50];
                    data.cell.styles.fontStyle = "bold";
                } else {
                    data.cell.styles.textColor = [34, 160, 100];
                    data.cell.styles.fontStyle = "bold";
                }
            }
            // Color percentage column
            if (data.section === "body" && data.column.index === 6) {
                const pct = parseFloat(data.cell.raw);
                if (pct < 75) {
                    data.cell.styles.textColor = [220, 50, 50];
                    data.cell.styles.fontStyle = "bold";
                }
            }
        },
        margin: { left: 14, right: 14 },
    });

    // ---- Footer ----
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Page ${i} of ${pageCount} | AttendX Attendance System`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 8,
            { align: "center" }
        );
    }

    // Save
    const fileName = `AttendX_Report_${meta.class_name}_${meta.course_code}_${meta.report_date}.pdf`;
    doc.save(fileName.replace(/\s+/g, "_"));
}


// ==================== ALL CLASSES REPORT ====================
async function viewAllClassesReport() {
    try {
        const res = await apiFetch("/api/teacher/my-courses");
        if (!res.ok) return;

        const courses = await res.json();
        let html = "";

        for (const c of courses) {
            const reportRes = await apiFetch(`/api/teacher/report-full/${c.id}`);
            if (!reportRes.ok) continue;

            const data = await reportRes.json();
            const meta = data.meta;
            const students = data.students;

            html += `<div style="margin-bottom: 25px;">`;
            html += `<h4 style="margin:0 0 5px; color:var(--white-soft);"><i class="ri-book-2-line" style="margin-right:4px;"></i>${meta.class_name} — ${meta.subject}</h4>`;
            html += `<p style="color:var(--white-muted); font-size:0.85rem; margin-bottom:10px;">Credit Hours: ${meta.credit_hours} | Teacher: ${meta.teacher_name} | Classes Held: ${meta.total_classes}</p>`;

            if (students.length === 0) {
                html += '<p class="hint">No students enrolled.</p>';
            } else {
                html += '<table><thead><tr><th>#</th><th>Student ID</th><th>Name</th><th>Present</th><th>Absent</th><th>%</th><th>Status</th></tr></thead><tbody>';
                students.forEach((s, i) => {
                    const rowBg = s.is_short ? 'background: rgba(248, 113, 113, 0.08);' : '';
                    const pctColor = s.is_short ? '#f87171' : '#34d399';
                    const badge = s.is_short
                        ? '<span style="background:rgba(248,113,113,0.2);color:#f87171;padding:2px 8px;border-radius:12px;font-size:0.7rem;font-weight:600;">SHORT</span>'
                        : '<span style="background:rgba(52,211,153,0.2);color:#34d399;padding:2px 8px;border-radius:12px;font-size:0.7rem;font-weight:600;">OK</span>';
                    html += `<tr style="${rowBg}"><td>${i+1}</td><td>${s.student_id}</td><td>${s.student_name}</td><td style="color:#34d399;">${s.present}</td><td style="color:#f87171;">${s.absent}</td><td style="color:${pctColor};font-weight:600;">${s.percentage}%</td><td>${badge}</td></tr>`;
                });
                html += '</tbody></table>';
            }
            html += `</div><hr>`;
        }

        const area = document.getElementById("teacher-report-area");
        if (!area) return;
        document.getElementById("report-summary-area").style.display = "block";
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
