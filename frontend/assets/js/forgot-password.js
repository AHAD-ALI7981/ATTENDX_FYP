const API_URL = `${window.location.origin}/api`;

// Handle Forgot Password Form
const forgotForm = document.getElementById('forgot-password-form');
if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('forgot-email').value;
        const messageDiv = document.getElementById('forgot-message');
        const btn = document.getElementById('forgot-btn');
        
        btn.disabled = true;
        btn.textContent = 'Sending...';
        
        try {
            const response = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            messageDiv.style.display = 'block';
            if (response.ok) {
                messageDiv.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
                messageDiv.style.border = '1px solid #4CAF50';
                messageDiv.style.color = '#fff';
                messageDiv.textContent = data.message;
            } else {
                messageDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
                messageDiv.style.border = '1px solid #F44336';
                messageDiv.style.color = '#fff';
                messageDiv.textContent = data.detail || 'An error occurred';
            }
        } catch (error) {
            messageDiv.style.display = 'block';
            messageDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
            messageDiv.style.border = '1px solid #F44336';
            messageDiv.style.color = '#fff';
            messageDiv.textContent = 'Network error. Please try again later.';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Reset Link';
        }
    });
}

// Handle Reset Password Form
const resetForm = document.getElementById('reset-password-form');
if (resetForm) {
    // Eye icon toggle for new password
    const newPassEye = document.getElementById('new-password-eye');
    const newPassInput = document.getElementById('new-password');
    if (newPassEye && newPassInput) {
        newPassEye.addEventListener('click', () => {
            if(newPassInput.type === 'password'){
                newPassInput.type = 'text';
                newPassEye.classList.add('ri-eye-line');
                newPassEye.classList.remove('ri-eye-off-line');
            } else {
                newPassInput.type = 'password';
                newPassEye.classList.remove('ri-eye-line');
                newPassEye.classList.add('ri-eye-off-line');
            }
        });
    }

    // Eye icon toggle for confirm password
    const confirmPassEye = document.getElementById('confirm-password-eye');
    const confirmPassInput = document.getElementById('confirm-password');
    if (confirmPassEye && confirmPassInput) {
        confirmPassEye.addEventListener('click', () => {
            if(confirmPassInput.type === 'password'){
                confirmPassInput.type = 'text';
                confirmPassEye.classList.add('ri-eye-line');
                confirmPassEye.classList.remove('ri-eye-off-line');
            } else {
                confirmPassInput.type = 'password';
                confirmPassEye.classList.remove('ri-eye-line');
                confirmPassEye.classList.add('ri-eye-off-line');
            }
        });
    }

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const messageDiv = document.getElementById('reset-message');
        const btn = document.getElementById('reset-btn');
        
        messageDiv.style.display = 'block';
        
        if (!token) {
            messageDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
            messageDiv.style.border = '1px solid #F44336';
            messageDiv.style.color = '#fff';
            messageDiv.textContent = 'Invalid or missing token. Please request a new link.';
            return;
        }

        if (newPassword.length < 8) {
            messageDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
            messageDiv.style.border = '1px solid #F44336';
            messageDiv.style.color = '#fff';
            messageDiv.textContent = 'Password must be at least 8 characters.';
            return;
        }
        if (!/[A-Z]/.test(newPassword)) {
            messageDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
            messageDiv.style.border = '1px solid #F44336';
            messageDiv.style.color = '#fff';
            messageDiv.textContent = 'Password must contain at least one uppercase letter.';
            return;
        }
        if (!/[a-z]/.test(newPassword)) {
            messageDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
            messageDiv.style.border = '1px solid #F44336';
            messageDiv.style.color = '#fff';
            messageDiv.textContent = 'Password must contain at least one lowercase letter.';
            return;
        }
        if (!/[0-9]/.test(newPassword)) {
            messageDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
            messageDiv.style.border = '1px solid #F44336';
            messageDiv.style.color = '#fff';
            messageDiv.textContent = 'Password must contain at least one digit.';
            return;
        }

        if (newPassword !== confirmPassword) {
            messageDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
            messageDiv.style.border = '1px solid #F44336';
            messageDiv.style.color = '#fff';
            messageDiv.textContent = 'Passwords do not match.';
            return;
        }
        
        btn.disabled = true;
        btn.textContent = 'Resetting...';
        
        try {
            const response = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: newPassword })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                messageDiv.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
                messageDiv.style.border = '1px solid #4CAF50';
                messageDiv.style.color = '#fff';
                messageDiv.innerHTML = `${data.message} <br><br><a href="login.html" style="color: white; text-decoration: underline;">Go to Login</a>`;
                resetForm.reset();
            } else {
                messageDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
                messageDiv.style.border = '1px solid #F44336';
                messageDiv.style.color = '#fff';
                messageDiv.textContent = data.detail || 'An error occurred';
                btn.disabled = false;
                btn.textContent = 'Reset Password';
            }
        } catch (error) {
            messageDiv.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
            messageDiv.style.border = '1px solid #F44336';
            messageDiv.style.color = '#fff';
            messageDiv.textContent = 'Network error. Please try again later.';
            btn.disabled = false;
            btn.textContent = 'Reset Password';
        }
    });
}
