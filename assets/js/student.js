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
            card.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:16px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.08); border-radius:12px; gap:16px; background:rgba(255,255,255,0.03);";
            card.innerHTML = `
                <div style="min-width:0;">
                    <div style="font-size:1rem; font-weight:700; margin-bottom:6px; color:#fff;">${c.class_name} — ${c.subject}</div>
                    <div style="font-size:0.9rem; color:#9ca3af; margin-bottom:4px;">Teacher: ${c.teacher_name || 'Unknown'}</div>
                    <div style="font-size:0.9rem; color:#9ca3af;">Credit Hours: ${c.credit_hours || 3}</div>
                </div>
                <button class="action-btn btn-download-sheet" data-course-id="${c.id}" style="flex-shrink:0; min-width:170px;">Download Attendance Sheet</button>
            `;
            list.appendChild(card);
        });

        list.querySelectorAll('.btn-download-sheet').forEach((btn) => {
            btn.addEventListener('click', () => {
                const courseId = btn.dataset.courseId;
                downloadAttendanceSheet(courseId);
            });
        });
    } catch (err) {
        console.error("Failed to load enrolled courses:", err);
    }
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
        
        let htmlContext = `<p style="color:var(--white-soft); margin-bottom:10px;">Showing records for <strong>${data.student_name} (${data.student_id})</strong></p>`;
        
        htmlContext += `
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; background:rgba(255,255,255,0.05); padding:10px; border-radius:6px;">
                <div style="text-align:center;">
                    <div style="font-size:12px; color:#9ca3af;">Total Classes</div>
                    <div style="font-size:20px; font-weight:600; color:#fff;">${data.total_classes}</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:12px; color:#9ca3af;">Present</div>
                    <div style="font-size:20px; font-weight:600; color:#34d399;">${data.present}</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:12px; color:#9ca3af;">Percentage</div>
                    <div style="font-size:20px; font-weight:600; color:#60a5fa;">${data.percentage}%</div>
                </div>
            </div>
        `;

        // Create detailed history table
        let table = '<table style="width:100%; text-align:left; border-collapse:collapse;">';
        table += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,0.1);"><th>Date</th><th>Status</th></tr></thead><tbody>';
        
        if (data.records && data.records.length > 0) {
            data.records.forEach(r => {
                const color = r.status.toLowerCase() === 'present' ? '#34d399' : '#f87171';
                table += `<tr><td style="padding:8px 0;">${r.date}</td><td style="padding:8px 0; color:${color}; font-weight:500;">${r.status.toUpperCase()}</td></tr>`;
            });
        } else {
            table += '<tr><td colspan="2" style="padding:8px 0; text-align:center; color:#9ca3af;">No attendance records found.</td></tr>';
        }
        table += '</tbody></table>';

        reportDiv.innerHTML = htmlContext + table;
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
    });

    const fileName = `Attendance_Sheet_${data.class_name.replace(/\s+/g, '_')}_${data.subject.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
}
