/**
 * auth.js — Handles secure authentication via HttpOnly cookies (No localStorage!)
 */

const API_BASE = window.location.origin;

let currentUser = null; // Stored securely in memory, wiped on page refresh

/**
 * Universal wrapper for API calls that automatically includes secure cookies
 */
async function apiFetch(endpoint, options = {}) {
    options.credentials = "include"; // MUST be sent so frontend passes cookies to backend
    if (!options.headers) {
        options.headers = {};
    }
    if (!(options.body instanceof FormData) && !options.headers["Content-Type"]) {
        options.headers["Content-Type"] = "application/json";
    }
    
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    
    if (res.status === 401 && !endpoint.includes("/login") && !endpoint.includes("/me")) {
        // If cookie expired or invalid, instantly kick to login
        window.location.href = "login.html";
    }
    return res;
}

/**
 * Blocks dashboard access if there is no active server-side active cookie session
 */
async function requireAuth() {
    try {
        const res = await apiFetch("/api/auth/me");
        if (res.ok) {
            currentUser = await res.json();
            const welcomeMsg = document.getElementById("welcome-msg");
            if (welcomeMsg) {
                welcomeMsg.textContent = `Welcome, ${currentUser.username}`;
            }
            return true;
        }
    } catch(err) {
        console.error("Require Auth Error:", err);
    }
    window.location.href = "login.html";
    return false;
}

/**
 * Securely clear cookie via backend and redirect
 */
async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.href = "login.html";
}


document.addEventListener("DOMContentLoaded", () => {
    // ---- LOGIN FORM ----
    const form = document.querySelector(".login__form");
    if (!form || form.id === "register-form") return; // skip if we are on register page

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = document.getElementById("login-username").value.trim();
        const password = document.getElementById("login-pass").value.trim();

        if (!username || !password) {
            alert("Please enter both username and password.");
            return;
        }

        try {
            // Using standard fetch here to securely pass credentials mode
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
                credentials: "include" // This allows the browser to set the Set-Cookie header
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.detail || "Login failed");
                return;
            }

            // Notice we do NOT use localStorage anywhere!
            switch (data.role) {
                case "admin":
                    window.location.href = "admindashboard.html";
                    break;
                case "teacher":
                    window.location.href = "teacherdashboard.html";
                    break;
                case "student":
                    window.location.href = "student_dashboard.html";
                    break;
                default:
                    alert("Unknown role");
            }
        } catch (err) {
            console.error("Login error:", err);
            alert("Unable to connect to server. Make sure the backend is running.");
        }
    });

    // Password visibility toggle logic
    const eyeIcon = document.getElementById("login-eye");
    const passInput = document.getElementById("login-pass");
    if (eyeIcon && passInput) {
        eyeIcon.addEventListener("click", () => {
            if (passInput.type === "password") {
                passInput.type = "text";
                eyeIcon.classList.replace("ri-eye-off-line", "ri-eye-line");
            } else {
                passInput.type = "password";
                eyeIcon.classList.replace("ri-eye-line", "ri-eye-off-line");
            }
        });
    }
});
