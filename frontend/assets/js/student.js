/**
 * student.js — Student dashboard logic.
 * Securely uses HttpOnly cookies via apiFetch wrapper and currentUser memory state.
 */

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
            navItems.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            const targetTab = document.getElementById(targetId);
            if (targetTab) targetTab.classList.add('active');
        });
    });

    // Initial load — only shows enrolled courses
    loadStudentCourses();

    // Button event listener
    document.getElementById("btn-check-attendance").addEventListener("click", checkAttendance);
});

async function loadStudentCourses() {
    try {
        const res = await apiFetch("/api/student/courses");
        if (!res.ok) return;

        const courses = await res.json();
        const select = document.getElementById("student-course-select");
        const list = document.getElementById("student-courses-list");
        select.innerHTML = '<option value="" disabled selected>Select Course...</option>';
        list.innerHTML = "";

        if (courses.length === 0) {
            const opt = document.createElement("option");
            opt.disabled = true;
            opt.textContent = "No enrolled courses found";
            select.appendChild(opt);

            list.innerHTML = '<p class="hint" style="margin: 0;">You are not enrolled in any courses yet.</p>';
            return;
        }

        courses.forEach((c) => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = `${c.class_name} — ${c.subject}`;
            select.appendChild(opt);

            const card = document.createElement("div");
            card.className = "course-card";
            card.dataset.courseId = c.id;
            card.innerHTML = `
                <div class="course-card-header">
                    <div class="course-card-title">
                        <i class="ri-book-2-line" style="color: var(--accent); font-size: 1.1rem;"></i>
                        <div>
                            <div style="font-weight: 600; color: #fff; font-size: 0.95rem; line-height: 1.3;">${c.class_name}</div>
                            <div style="font-size: 0.82rem; color: var(--white-muted); margin-top: 2px;">${c.subject}</div>
                        </div>
                    </div>
                    <i class="ri-eye-line" style="color: var(--white-muted); font-size: 1.1rem;"></i>
                </div>
            `;
            
            card.addEventListener("click", () => openCourseDetailModal(c));

            list.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to load enrolled courses:", err);
    }
}

function openCourseDetailModal(course) {
    const modal = document.getElementById("course-detail-modal");
    document.getElementById("course-modal-title").textContent = course.class_name;
    document.getElementById("course-modal-subtitle").textContent = course.subject;

    const table = document.getElementById("course-modal-table");
    table.innerHTML = `
        <tr>
            <td><i class="ri-hashtag" style="color: var(--accent);"></i> Course Code</td>
            <td>${course.course_code}</td>
        </tr>
        <tr>
            <td><i class="ri-book-open-line" style="color: var(--purple);"></i> Subject</td>
            <td>${course.course_description || course.subject}</td>
        </tr>
        <tr>
            <td><i class="ri-time-line" style="color: var(--success);"></i> Credit Hours</td>
            <td>${course.credit_hours}</td>
        </tr>
        <tr>
            <td><i class="ri-user-star-line" style="color: #f59e0b;"></i> Teacher</td>
            <td>${course.teacher_name}</td>
        </tr>
    `;

    modal.classList.add("active");

    // Close handlers
    const closeBtn = document.getElementById("course-modal-close");
    const closeHandler = () => {
        modal.classList.remove("active");
        closeBtn.removeEventListener("click", closeHandler);
    };
    closeBtn.addEventListener("click", closeHandler);

    // Click outside to close
    const outsideHandler = (e) => {
        if (e.target === modal) {
            modal.classList.remove("active");
            modal.removeEventListener("click", outsideHandler);
        }
    };
    modal.addEventListener("click", outsideHandler);

    // Escape key to close
    const escHandler = (e) => {
        if (e.key === "Escape") {
            modal.classList.remove("active");
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);
}

async function checkAttendance() {
    const courseId = document.getElementById("student-course-select").value;

    if (!courseId) {
        alert("Please select a course to check attendance.");
        return;
    }

    try {
        // Auto-detects student from JWT — no manual student_id needed
        const res = await apiFetch(`/api/student/attendance/${courseId}`);
        const data = await res.json();

        if (!res.ok) {
            alert(data.detail || "Error fetching attendance");
            return;
        }

        const reportDiv = document.getElementById("student-report-detail");
        
        let htmlContext = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px; margin-bottom:20px; flex-wrap:wrap;">
                <div style="min-width:0;">
                    <div style="font-size:0.9rem; color:#9ca3af; margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">Attendance Sheet</div>
                    <div style="font-size:1.35rem; font-weight:700; color:#fff; line-height:1.2;">${data.class_name} — ${data.subject}</div>
                    <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:10px; color:#d1d5db; font-size:0.9rem;">
                        <span><strong style="color:#fff;">Teacher:</strong> ${data.teacher_name}</span>
                        <span><strong style="color:#fff;">Credit Hours:</strong> ${data.credit_hours}</span>
                        <span><strong style="color:#fff;">Date:</strong> ${new Date().toLocaleDateString()}</span>
                    </div>
                </div>
                <button class="secondary-btn" id="btn-download-attendance-pdf" style="min-width:180px; height:44px; align-self:flex-start; padding: 8px 18px; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
                    <i class="ri-download-2-line"></i> Download PDF
                </button>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:14px; margin-bottom:22px;">
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:18px;">
                    <div style="font-size:0.8rem; color:#9ca3af; margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">Total Classes</div>
                    <div style="font-size:1.4rem; font-weight:700; color:#fff;">${data.total_classes}</div>
                </div>
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:18px;">
                    <div style="font-size:0.8rem; color:#9ca3af; margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">Present</div>
                    <div style="font-size:1.4rem; font-weight:700; color:#34d399;">${data.present}</div>
                </div>
                <div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:18px;">
                    <div style="font-size:0.8rem; color:#9ca3af; margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">Percentage</div>
                    <div style="font-size:1.4rem; font-weight:700; color:#60a5fa;">${data.percentage}%</div>
                </div>
            </div>
        `;

        // Create detailed history table
        let table = '<table style="width:100%; text-align:left; border-collapse:collapse; color:#fff;">';
        table += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.12);">';
        table += '<th style="padding:14px 12px; color:#d1d5db; font-size:0.85rem; letter-spacing:0.08em; text-transform:uppercase;">Date</th>';
        table += '<th style="padding:14px 12px; color:#d1d5db; font-size:0.85rem; letter-spacing:0.08em; text-transform:uppercase;">Status</th>';
        table += '</tr></thead><tbody>';
        
        if (data.records && data.records.length > 0) {
            data.records.forEach((r, index) => {
                const rowBg = index % 2 === 0 ? 'background: rgba(255,255,255,0.03);' : '';
                const color = r.status.toLowerCase() === 'present' ? '#34d399' : '#f87171';
                table += `<tr style="${rowBg}">`;
                table += `<td style="padding:14px 12px; border-bottom:1px solid rgba(255,255,255,0.08);">${r.date}</td>`;
                table += `<td style="padding:14px 12px; border-bottom:1px solid rgba(255,255,255,0.08); color:${color}; font-weight:600;">${r.status.toUpperCase()}</td>`;
                table += `</tr>`;
            });
        } else {
            table += '<tr><td colspan="2" style="padding:18px 12px; text-align:center; color:#9ca3af;">No attendance records found.</td></tr>';
        }
        table += '</tbody></table>';

        reportDiv.innerHTML = htmlContext + table;
        const downloadBtn = document.getElementById("btn-download-attendance-pdf");
        if (downloadBtn) {
            downloadBtn.addEventListener("click", () => generateAttendancePDF(data));
        }
        document.getElementById("student-action-area").style.display = "block";

    } catch (err) {
        console.error(err);
        alert("Server error verifying your attendance metrics.");
    }
}

async function downloadAttendanceSheet(courseId) {
    if (!courseId) {
        alert("Course not found for PDF download.");
        return;
    }

    try {
        const res = await apiFetch(`/api/student/attendance/${courseId}`);
        const data = await res.json();

        if (!res.ok) {
            alert(data.detail || "Unable to fetch attendance sheet data.");
            return;
        }

        generateAttendancePDF(data);
    } catch (err) {
        console.error(err);
        alert("Server error generating attendance sheet PDF.");
    }
}

function generateAttendancePDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const title = 'Attendance Sheet';
    const subtitle = `${data.class_name} — ${data.subject}`;
    const meta = [`Student: ${data.student_name} (${data.student_id})`, `Teacher: ${data.teacher_name}`, `Credit Hours: ${data.credit_hours}`];

    doc.setFontSize(18);
    doc.setTextColor(21, 32, 43);
    doc.text(title, 14, 18);

    doc.setFontSize(12);
    doc.setTextColor(99, 115, 129);
    doc.text(subtitle, 14, 26);

    doc.setFontSize(10);
    doc.setTextColor(94, 92, 100);
    meta.forEach((line, index) => {
        doc.text(line, 14, 34 + index * 6);
    });

    const summaryY = 34 + meta.length * 6 + 8;
    doc.setFillColor(238, 242, 255);
    doc.rect(14, summaryY - 6, 182, 18, 'F');

    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Total Classes: ${data.total_classes}`, 16, summaryY + 4);
    doc.text(`Present: ${data.present}`, 16, summaryY + 10);
    doc.text(`Attendance: ${data.percentage}%`, 80, summaryY + 4);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 80, summaryY + 10);

    const rows = (data.records || []).map((record) => [record.date, record.status.toUpperCase()]);

    doc.autoTable({
        startY: summaryY + 18,
        head: [['Date', 'Status']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: 255 },
        styles: { textColor: [34, 43, 69], fontSize: 10 },
        columnStyles: { 1: { halign: 'center' } },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 1) {
                if (data.cell.raw === 'ABSENT') {
                    data.cell.styles.textColor = [220, 50, 50];
                    data.cell.styles.fontStyle = 'bold';
                } else if (data.cell.raw === 'PRESENT') {
                    data.cell.styles.textColor = [34, 160, 100];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    const fileName = `Attendance_Sheet_${data.class_name.replace(/\s+/g, '_')}_${data.subject.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
}
