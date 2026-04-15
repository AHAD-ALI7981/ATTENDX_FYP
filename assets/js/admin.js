/**
 * admin.js — Admin dashboard logic.
 * Securely uses HttpOnly cookies via apiFetch.
 */

document.addEventListener("DOMContentLoaded", async () => {
    const isAuthenticated = await requireAuth();
    if (!isAuthenticated) return;

    // Logout button
    document.querySelector(".logout-btn").addEventListener("click", logout);

    // Initial loads
    loadCourses();
    loadUsers();

    // Create user button
    document.getElementById("btn-create-user").addEventListener("click", createUser);

    // Add course button
    document.getElementById("btn-add-course").addEventListener("click", addCourse);
});

async function createUser() {
    const username = document.getElementById("admin-user-username").value.trim();
    const password = document.getElementById("admin-user-password").value.trim();
    const role = document.getElementById("admin-user-role").value;

    if (!username || !password || !role) {
        alert("Please fill in all fields for the user.");
        return;
    }

    try {
        const res = await apiFetch("/api/admin/users", {
            method: "POST",
            body: JSON.stringify({ username, password, role }),
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Failed to create user");
            return;
        }

        alert(data.message);
        document.getElementById("admin-user-username").value = "";
        document.getElementById("admin-user-password").value = "";
        loadUsers();
    } catch (err) {
        console.error(err);
        alert("Server error creating user.");
    }
}

async function loadUsers() {
    // Optional: add a table for users if needed, 
    // for now we just load them to ensure the API works.
}

async function addCourse() {
    const className = document.getElementById("admin-course-class").value.trim();
    const subject = document.getElementById("admin-course-name").value.trim();
    const teacherName = document.getElementById("admin-teacher-name").value.trim();

    if (!className || !subject || !teacherName) {
        alert("Please fill in all fields.");
        return;
    }

    try {
        const res = await apiFetch("/api/admin/courses", {
            method: "POST",
            body: JSON.stringify({
                class_name: className,
                subject: subject,
                teacher_username: teacherName,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Failed to add course");
            return;
        }

        alert(data.message);
        // Clear inputs
        document.getElementById("admin-course-class").value = "";
        document.getElementById("admin-course-name").value = "";
        document.getElementById("admin-teacher-name").value = "";
        // Reload table
        loadCourses();
    } catch (err) {
        console.error(err);
        alert("Server error. Make sure the backend is running.");
    }
}

async function loadCourses() {
    try {
        const res = await apiFetch("/api/admin/courses");
        if (!res.ok) return;

        const courses = await res.json();
        const tbody = document.querySelector("#admin-course-table tbody");
        tbody.innerHTML = "";

        courses.forEach((c) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${c.class_name}</td>
                <td>${c.subject}</td>
                <td>${c.teacher_name}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Failed to load courses:", err);
    }
}
