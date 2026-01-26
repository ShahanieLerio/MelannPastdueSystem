// client/login.js
/*
  Handles login form submission.
  - Sends POST /api/auth/login with username/password.
  - On success stores JWT in localStorage under key "token".
  - Redirects to the main UI (index.html).
  - Displays error messages on failure.
*/

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const messageDiv = document.getElementById('loginMessage');
    const formTitle = document.getElementById('formTitle');
    const brandTitle = document.getElementById('brandTitle');
    const formSide = document.querySelector('.login-form-side');
    // Event Delegation for Toggle Login / Register
    // We listen on the parent container (login-form-side or document)
    formSide.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'toggleFormBtn') {
            e.preventDefault();
            messageDiv.textContent = '';

            if (loginForm.classList.contains('hidden')) {
                // Switch to Login
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
                toggleText.innerHTML = 'Don\'t have an account? <a href="#" id="toggleFormBtn" style="color:var(--color-primary); font-weight:600; text-decoration:none;">Sign Up</a>';
                if (formTitle) formTitle.textContent = 'Past Due & Reporting Monitoring';
                if (brandTitle) brandTitle.textContent = 'Melann Lending';
                formSide.classList.remove('signup-active');
            } else {
                // Switch to Register
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
                toggleText.innerHTML = 'Already have an account? <a href="#" id="toggleFormBtn" style="color:var(--color-primary); font-weight:600; text-decoration:none;">Sign In</a>';
                if (formTitle) formTitle.textContent = 'Sign Up';
                if (brandTitle) brandTitle.textContent = 'Past Due and Reports Monitoring';
                formSide.classList.add('signup-active');
            }
        }
    });

    // Password Toggle Logic
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const passwordInput = document.getElementById('password');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePasswordBtn.classList.toggle('fa-eye');
            togglePasswordBtn.classList.toggle('fa-eye-slash');
        });
    }

    // Handle Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = loginForm.username.value.trim();
        const password = loginForm.password.value;

        try {
            const resp = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Login failed');
            }

            const data = await resp.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('userInfo', JSON.stringify(data.user));
            window.location.href = 'index.html';
        } catch (err) {
            console.error(err);
            messageDiv.textContent = err.message;
            messageDiv.style.color = '#ef4444';
        }
    });

    // Handle Register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const full_name = registerForm.full_name.value.trim();
        const username = registerForm.username.value.trim();
        const password = registerForm.password.value;
        const role = registerForm.role.value;

        try {
            const resp = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, full_name, role })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Registration failed');
            }

            const data = await resp.json();
            // Success
            messageDiv.textContent = 'Account created! Please sign in.';
            messageDiv.style.color = '#10b981'; // success green

            // Switch back to login view after short delay
            setTimeout(() => {
                // Manually trigger switch back
                if (!loginForm.classList.contains('hidden')) return;
                toggleBtn.click();
                // Pre-fill username
                loginForm.username.value = username;
            }, 1000);

        } catch (err) {
            console.error(err);
            messageDiv.textContent = err.message;
            messageDiv.style.color = '#ef4444';
        }
    });
});
