/**
 * admin.js — Admin dashboard logic.
 * Securely uses HttpOnly cookies via apiFetch.
 */

document.addEventListener("DOMContentLoaded", async () => {
    const isAuthenticated = await requireAuth();
    if (!isAuthenticated) return;

    // Logout button
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
                // Refresh teacher list if adding a course
                if (targetId === "add-course-tab") {
                    loadTeachersToSelect("admin-teacher-select");
                } else if (targetId === "create-class-tab") {
                    loadTeachersToSelect("admin-class-teacher-select");
                    loadClasses();
                } else if (targetId === "create-course-tab") {
                    loadCourseDefs();
                }
            }
        });
    });

    // Initial loads
    loadCourses();
    loadUsers();

    // Create user buttons
    const btnCreateTeacher = document.getElementById("btn-create-teacher");
    const btnCreateStudent = document.getElementById("btn-create-student");
    if(btnCreateTeacher) btnCreateTeacher.addEventListener("click", () => createUser("teacher"));
    if(btnCreateStudent) btnCreateStudent.addEventListener("click", () => createUser("student"));

    // Password Generation buttons
    const btnGenTeacherPwd = document.getElementById("btn-generate-teacher-password");
    const btnGenStudentPwd = document.getElementById("btn-generate-student-password");
    
    if(btnGenTeacherPwd) {
        btnGenTeacherPwd.addEventListener("click", () => generateRandomPassword("teacher"));
        generateRandomPassword("teacher");
    }
    if(btnGenStudentPwd) {
        btnGenStudentPwd.addEventListener("click", () => generateRandomPassword("student"));
        generateRandomPassword("student");
    }

    // Password Generation button in Edit Modal
    const btnGenEditPwd = document.getElementById("btn-generate-edit-password");
    if(btnGenEditPwd) {
        btnGenEditPwd.addEventListener("click", () => {
            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
            let password = "";
            for (let i = 0; i < 8; i++) {
                password += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            document.getElementById("edit-user-password").value = password;
        });
    }

    // Add course button
    document.getElementById("btn-add-course").addEventListener("click", addCourse);

    // New management buttons
    document.getElementById("btn-create-class").addEventListener("click", createClass);
    document.getElementById("btn-create-course-def").addEventListener("click", createCourseDef);
});

function generateRandomPassword(role) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let password = "";
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const pwdInput = document.getElementById(`admin-${role}-password`);
    if (pwdInput) pwdInput.value = password;
}

async function createUser(role) {
    const username = document.getElementById(`admin-${role}-username`).value.trim();
    const password = document.getElementById(`admin-${role}-password`).value.trim();

    if (!username || !password) {
        alert(`Please fill in all fields for the ${role}.`);
        return;
    }

    try {
        const res = await apiFetch("/api/admin/users", {
            method: "POST",
            body: JSON.stringify({ username, password, role }),
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || `Failed to create ${role}`);
            return;
        }

        alert(data.message);
        document.getElementById(`admin-${role}-username`).value = "";
        generateRandomPassword(role); // Generate a fresh password for the next user
        loadUsers();
    } catch (err) {
        console.error(err);
        alert(`Server error creating ${role}.`);
    }
}

// Pagination and filtering state
let currentPage = 1;
const limit = 10;
let totalPages = 1;

// Elements
const searchInput = document.getElementById("admin-user-search");
const roleFilter = document.getElementById("admin-user-filter-role");
const prevBtn = document.getElementById("btn-prev-page");
const nextBtn = document.getElementById("btn-next-page");
const pageInfo = document.getElementById("page-info");
const editModal = document.getElementById("edit-user-modal");

// Setup event listeners for filtering & pagination
if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentPage = 1;
            loadUsers();
        }, 300);
    });
}
if (roleFilter) {
    roleFilter.addEventListener("change", () => {
        currentPage = 1;
        loadUsers();
    });
}
if (prevBtn) {
    prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            loadUsers();
        }
    });
}
if (nextBtn) {
    nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadUsers();
        }
    });
}
if (document.getElementById("btn-cancel-edit")) {
    document.getElementById("btn-cancel-edit").addEventListener("click", () => {
        editModal.classList.add("hidden");
    });
}
if (document.getElementById("btn-save-user")) {
    document.getElementById("btn-save-user").addEventListener("click", saveUserEdit);
}

async function loadUsers() {
    try {
        const searchTerm = searchInput ? searchInput.value.trim() : "";
        const role = roleFilter ? roleFilter.value : "all";
        
        let url = `/api/admin/users?page=${currentPage}&limit=${limit}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (role && role !== "all") url += `&role=${role}`;

        const res = await apiFetch(url);
        if (!res.ok) return;

        const data = await res.json();
        totalPages = data.total_pages || 1;
        currentPage = data.page;

        const tbody = document.querySelector("#admin-users-table tbody");
        if (tbody) {
            tbody.innerHTML = "";
            data.users.forEach((u) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${u.id}</td>
                    <td>${u.username}</td>
                    <td>${u.email || '-'}</td>
                    <td><span style="padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; background: rgba(255,255,255,0.1);">${u.role}</span></td>
                    <td>
                        <span style="font-family: monospace; letter-spacing: 1px; color: var(--accent);">${u.plain_password || '********'}</span>
                    </td>
                    <td>
                        <button class="action-icon edit" onclick="openEditModal(${u.id}, '${u.email || ''}', '${u.role}', '${u.plain_password || ''}')"><i class="ri-edit-line"></i></button>
                        <button class="action-icon delete" onclick="deleteUser(${u.id}, '${u.username}')"><i class="ri-delete-bin-line"></i></button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    } catch (err) {
        console.error("Failed to load users:", err);
    }
}

function openEditModal(id, email, role, plainPassword) {
    document.getElementById("edit-user-id").value = id;
    document.getElementById("edit-user-email").value = email;
    document.getElementById("edit-user-role").value = role;
    document.getElementById("edit-user-password").value = plainPassword;
    editModal.classList.remove("hidden");
}

async function saveUserEdit() {
    const id = document.getElementById("edit-user-id").value;
    const email = document.getElementById("edit-user-email").value.trim();
    const role = document.getElementById("edit-user-role").value;
    const password = document.getElementById("edit-user-password").value.trim();

    try {
        const res = await apiFetch(`/api/admin/users/${id}`, {
            method: "PUT",
            body: JSON.stringify({ 
                email: email || null, 
                role,
                password: password || null
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Failed to update user");
            return;
        }

        alert(data.message);
        editModal.classList.add("hidden");
        loadUsers();
    } catch (err) {
        console.error(err);
        alert("Server error updating user.");
    }
}

async function deleteUser(id, username) {
    if (username === "admin") {
        alert("Cannot delete the default admin account.");
        return;
    }
    
    if (!confirm(`Are you sure you want to permanently delete the user '${username}'? This will also delete any associated data.`)) {
        return;
    }

    try {
        const res = await apiFetch(`/api/admin/users/${id}`, {
            method: "DELETE"
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Failed to delete user");
            return;
        }

        alert(data.message);
        loadUsers();
    } catch (err) {
        console.error(err);
        alert("Server error deleting user.");
    }
}

async function addCourse() {
    const className = document.getElementById("admin-course-class").value.trim();
    const subject = document.getElementById("admin-course-name").value.trim();
    
    const teacherSelect = document.getElementById("admin-teacher-select");
    const selectedOption = teacherSelect ? teacherSelect.options[teacherSelect.selectedIndex] : null;
    const teacherName = (selectedOption && selectedOption.value) ? selectedOption.getAttribute('data-username') : null;

    if (!className || !subject || !teacherName) {
        alert("Please fill in all fields and select a teacher.");
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
        if (teacherSelect) teacherSelect.selectedIndex = 0;
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

async function loadTeachersToSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    try {
        const res = await apiFetch("/api/admin/users?role=teacher&limit=100");
        if (!res.ok) return;

        const data = await res.json();
        select.innerHTML = '<option value="">-- Choose a Teacher --</option>';
        
        data.users.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id; // Store ID for backend
            opt.textContent = `${t.username} (ID: ${t.id})`;
            // For the older 'addCourse' function which uses username, we might need to handle it.
            // But let's stick to IDs for new entities.
            // We'll update addCourse to use the textContent username if needed.
            opt.setAttribute('data-username', t.username);
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load teachers for selection:", err);
    }
}

// Keep the old function name for compatibility or refactor it
async function loadTeachersForSelection() {
    return loadTeachersToSelect("admin-teacher-select");
}

async function createClass() {
    const classId = document.getElementById("admin-class-id").value.trim();
    const className = document.getElementById("admin-class-name").value.trim();
    const teacherId = document.getElementById("admin-class-teacher-select").value;

    if (!classId || !className) {
        alert("Class ID and Name are required.");
        return;
    }

    try {
        const res = await apiFetch("/api/admin/classes", {
            method: "POST",
            body: JSON.stringify({
                class_id: classId,
                class_name: className,
                teacher_id: teacherId ? parseInt(teacherId) : null
            })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Failed to create class");
            return;
        }

        alert(data.message);
        document.getElementById("admin-class-id").value = "";
        document.getElementById("admin-class-name").value = "";
        document.getElementById("admin-class-teacher-select").selectedIndex = 0;
        loadClasses();
    } catch (err) {
        console.error(err);
        alert("Server error creating class.");
    }
}

async function loadClasses() {
    try {
        const res = await apiFetch("/api/admin/classes");
        if (!res.ok) return;

        const classes = await res.json();
        const tbody = document.querySelector("#admin-classes-table tbody");
        if (!tbody) return;

        tbody.innerHTML = "";
        classes.forEach(c => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${c.id}</td>
                <td>${c.class_id}</td>
                <td>${c.class_name}</td>
                <td>${c.teacher_name || 'Unassigned'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Failed to load classes:", err);
    }
}

async function createCourseDef() {
    const courseId = document.getElementById("admin-course-def-id").value.trim();
    const credits = document.getElementById("admin-course-def-credits").value;
    const desc = document.getElementById("admin-course-def-desc").value.trim();

    if (!courseId) {
        alert("Course ID is required.");
        return;
    }

    try {
        const res = await apiFetch("/api/admin/course-defs", {
            method: "POST",
            body: JSON.stringify({
                course_id: courseId,
                credit_hours: parseInt(credits),
                course_description: desc
            })
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Failed to create course");
            return;
        }

        alert(data.message);
        document.getElementById("admin-course-def-id").value = "";
        document.getElementById("admin-course-def-desc").value = "";
        loadCourseDefs();
    } catch (err) {
        console.error(err);
        alert("Server error creating course.");
    }
}

async function loadCourseDefs() {
    try {
        const res = await apiFetch("/api/admin/course-defs");
        if (!res.ok) return;

        const courses = await res.json();
        const tbody = document.querySelector("#admin-course-defs-table tbody");
        if (!tbody) return;

        tbody.innerHTML = "";
        courses.forEach(c => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${c.course_id}</td>
                <td>${c.course_description || '-'}</td>
                <td>${c.credit_hours}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Failed to load course definitions:", err);
    }
}
