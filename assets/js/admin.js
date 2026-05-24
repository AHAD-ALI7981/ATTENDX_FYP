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
                // Refresh data based on which tab is opened
                if (targetId === "create-user-tab") {
                    loadClassesToSelect("admin-student-class");
                } else if (targetId === "add-course-tab") {
                    loadClassesForDropdown();
                    loadCourseDefsForDropdown();
                    loadTeachersToSelect("admin-teacher-select");
                    loadCourses();
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
    const fullName = document.getElementById(`admin-${role}-name`).value.trim();
    const username = document.getElementById(`admin-${role}-username`).value.trim();
    const password = document.getElementById(`admin-${role}-password`).value.trim();

    if (!fullName || !username || !password) {
        alert(`Please fill in all fields for the ${role}.`);
        return;
    }

    const payload = { username, full_name: fullName, password, role };
    if (role === "student") {
        const classId = document.getElementById("admin-student-class").value;
        if (classId) payload.class_id = parseInt(classId);
    }

    try {
        const res = await apiFetch("/api/admin/users", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || `Failed to create ${role}`);
            return;
        }

        alert(data.message);
        document.getElementById(`admin-${role}-name`).value = "";
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
if (document.getElementById("edit-user-role")) {
    document.getElementById("edit-user-role").addEventListener("change", (e) => {
        const classSelect = document.getElementById("edit-user-class");
        if (e.target.value === "student") {
            classSelect.style.display = "block";
            loadClassesToSelect("edit-user-class", classSelect.dataset.currentClass);
        } else {
            classSelect.style.display = "none";
        }
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
                    <td>${u.full_name || '-'}</td>
                    <td>
                        <span style="padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; background: rgba(255,255,255,0.1); margin-right: 5px;">${u.role}</span>
                        ${u.role === 'student' && u.class_name ? `<span style="padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; background: rgba(96, 165, 250, 0.2); color: var(--accent);">${u.class_name}</span>` : ''}
                    </td>
                    <td>
                        <button class="action-icon edit" onclick="openEditModal(${u.id}, '${u.role}', '${(u.full_name || '').replace(/'/g, "\\'")}', '${u.class_id || ''}')"><i class="ri-edit-line"></i></button>
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

function openEditModal(id, role, fullName, classId) {
    document.getElementById("edit-user-id").value = id;
    document.getElementById("edit-user-name").value = fullName || "";
    document.getElementById("edit-user-role").value = role;
    document.getElementById("edit-user-password").value = "";
    
    const classSelect = document.getElementById("edit-user-class");
    if (role === "student") {
        classSelect.style.display = "block";
        classSelect.dataset.currentClass = classId || "";
        loadClassesToSelect("edit-user-class", classId);
    } else {
        classSelect.style.display = "none";
    }

    editModal.classList.remove("hidden");
}

async function saveUserEdit() {
    const id = document.getElementById("edit-user-id").value;
    const fullName = document.getElementById("edit-user-name").value.trim();
    const role = document.getElementById("edit-user-role").value;
    const password = document.getElementById("edit-user-password").value.trim();

    const payload = { 
        full_name: fullName || null,
        role,
        password: password || null
    };

    if (role === "student") {
        const classId = document.getElementById("edit-user-class").value;
        payload.class_id = classId ? parseInt(classId) : null;
    }

    try {
        const res = await apiFetch(`/api/admin/users/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
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


// ==================== COURSE ALLOTMENT ====================

async function loadClassesForDropdown() {
    try {
        const res = await apiFetch("/api/admin/classes");
        if (!res.ok) return;
        const classes = await res.json();
        const select = document.getElementById("admin-allot-class-select");
        if (!select) return;
        select.innerHTML = '<option value="">-- Choose a Class --</option>';
        classes.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = `${c.class_id} — ${c.class_name}`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load classes for dropdown:", err);
    }
}

async function loadCourseDefsForDropdown() {
    try {
        const res = await apiFetch("/api/admin/course-defs");
        if (!res.ok) return;
        const courses = await res.json();
        const select = document.getElementById("admin-allot-course-select");
        if (!select) return;
        select.innerHTML = '<option value="">-- Choose a Course --</option>';
        courses.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = `${c.course_id}${c.course_description ? ' — ' + c.course_description : ''}`;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load course defs for dropdown:", err);
    }
}

async function addCourse() {
    const classRefId = document.getElementById("admin-allot-class-select").value;
    const courseDefId = document.getElementById("admin-allot-course-select").value;
    const teacherSelect = document.getElementById("admin-teacher-select");
    const selectedOption = teacherSelect ? teacherSelect.options[teacherSelect.selectedIndex] : null;
    const teacherName = (selectedOption && selectedOption.value) ? selectedOption.getAttribute('data-username') : null;

    if (!classRefId || !courseDefId || !teacherName) {
        alert("Please select a class, course, and teacher.");
        return;
    }

    try {
        const res = await apiFetch("/api/admin/courses", {
            method: "POST",
            body: JSON.stringify({
                class_ref_id: parseInt(classRefId),
                course_def_id: parseInt(courseDefId),
                teacher_username: teacherName,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.detail || "Failed to allot course");
            return;
        }

        alert(data.message);
        // Clear selections
        document.getElementById("admin-allot-class-select").selectedIndex = 0;
        document.getElementById("admin-allot-course-select").selectedIndex = 0;
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
        if (!tbody) return;
        tbody.innerHTML = "";

        courses.forEach((c) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${c.class_name}</td>
                <td>${c.subject}</td>
                <td>${c.teacher_name}</td>
                <td>
                    <button class="action-icon delete" onclick="deleteCourse(${c.id})"><i class="ri-delete-bin-line"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Failed to load courses:", err);
    }
}

async function deleteCourse(id) {
    if (!confirm("Delete this course allotment? All related enrollments and attendance data will be removed.")) return;
    try {
        const res = await apiFetch(`/api/admin/courses/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) { alert(data.detail || "Failed to delete"); return; }
        alert(data.message);
        loadCourses();
    } catch (err) {
        console.error(err);
        alert("Server error deleting course.");
    }
}


// ==================== TEACHER DROPDOWN ====================

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
            opt.value = t.id;
            opt.textContent = t.full_name || t.username;
            opt.setAttribute('data-username', t.username);
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load teachers for selection:", err);
    }
}


// ==================== CLASS DROPDOWN ====================
async function loadClassesToSelect(selectId, selectedId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    try {
        const res = await apiFetch("/api/admin/classes");
        if (!res.ok) return;

        const data = await res.json();
        select.innerHTML = '<option value="">-- Assign Class (Optional) --</option>';
        
        data.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = `${c.class_id} — ${c.class_name}`;
            if (selectedId && c.id == selectedId) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Failed to load classes for selection:", err);
    }
}


// ==================== CLASS MANAGEMENT ====================

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
                <td>
                    <button class="action-icon delete" onclick="deleteClass(${c.id})"><i class="ri-delete-bin-line"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Failed to load classes:", err);
    }
}

async function deleteClass(id) {
    if (!confirm("Delete this class?")) return;
    try {
        const res = await apiFetch(`/api/admin/classes/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) { alert(data.detail || "Failed to delete"); return; }
        alert(data.message);
        loadClasses();
    } catch (err) {
        console.error(err);
        alert("Server error deleting class.");
    }
}


// ==================== COURSE DEFINITION MANAGEMENT ====================

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
                <td>
                    <button class="action-icon delete" onclick="deleteCourseDef(${c.id})"><i class="ri-delete-bin-line"></i></button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Failed to load course definitions:", err);
    }
}

async function deleteCourseDef(id) {
    if (!confirm("Delete this course definition?")) return;
    try {
        const res = await apiFetch(`/api/admin/course-defs/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) { alert(data.detail || "Failed to delete"); return; }
        alert(data.message);
        loadCourseDefs();
    } catch (err) {
        console.error(err);
        alert("Server error deleting course definition.");
    }
}
