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
        select.innerHTML = '<option value="" disabled selected>Select Course...</option>';

        if (courses.length === 0) {
            const opt = document.createElement("option");
            opt.disabled = true;
            opt.textContent = "No enrolled courses found";
            select.appendChild(opt);
            return;
        }

        courses.forEach((c) => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = `${c.class_name} — ${c.subject}`;
            select.appendChild(opt);
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
