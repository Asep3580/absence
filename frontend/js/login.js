document.addEventListener('DOMContentLoaded', function() {
    // GANTI DENGAN URL BACKEND ANDA DI CPANEL
    // const API_URL = 'https://api.absence.xenoshms.com';
    const API_URL = 'http://localhost:3000'; // Pakai API local dulu
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const registerLink = document.getElementById('register-company-link');

    // Redirect to a future registration page
    if (registerLink) {
        registerLink.addEventListener('click', (e) => {
            e.preventDefault();
            // For now, we can just alert the user. Later this would go to a registration page.
            alert('Fitur pendaftaran perusahaan akan segera hadir! Untuk saat ini, silakan gunakan akun yang sudah ada.');
            // window.location.href = 'register-company.html';
        });
    }
    
    // Toggle password visibility
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const isCurrentlyPassword = passwordInput.type === 'password';
            passwordInput.type = isCurrentlyPassword ? 'text' : 'password';
        });
    }

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        errorMessage.classList.add('hidden');
        const email = emailInput.value;
        const password = passwordInput.value;
        const submitButton = loginForm.querySelector('button[type="submit"]');


        submitButton.textContent = 'Memproses...';
        submitButton.disabled = true;

        try {
            const response = await fetch(`${API_URL}/api/auth/signin`, { // Sekarang URL akan menjadi benar
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }
            
            // Validasi: Pastikan data yang diterima dari server lengkap
            // Jika rolenya admin, WAJIB ada companyId.
            if (data.role === 'admin' && !data.companyId) {
                throw new Error('Login Gagal: Server tidak memberikan ID Perusahaan untuk admin.');
            }

            // Store token and user info
            localStorage.setItem('accessToken', data.accessToken);
            // Store user object without the token for security/clarity
            const user = {
                id: data.id,
                username: data.username,
                email: data.email,
                role: data.role,
                companyId: data.companyId,
                corporateId: data.corporateId || null
            };
            localStorage.setItem('user', JSON.stringify(user));

            // Redirect based on role
            if (user.role === 'superadmin') {
                window.location.href = 'saas-admin.html';
            } else if (user.role === 'corporate_admin') {
                window.location.href = 'corporate-admin.html';
            } else if (user.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }

        } catch (error) {
            console.error('Login Error:', error);
            errorMessage.classList.remove('hidden');
            // A more specific error message could be set here from error.message
        } finally {
            submitButton.textContent = 'Masuk';
            submitButton.disabled = false;
        }
    });
});
