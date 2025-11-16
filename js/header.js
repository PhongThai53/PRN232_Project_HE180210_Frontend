// js/header.js - ES module version of your header script
// Export: initHeader (default). The module also auto-inits on import.
export default function initHeader({ baseAPI = 'https://localhost:7108/api/auth', logoutAPI = '/logout' } = {}) {
    const showAlert = ({ title = '', message = '' } = {}) => {
        if (title && message) alert(title + '\n\n' + message);
        else if (title) alert(title);
        else alert(message || '');
    };

    const token = sessionStorage.getItem('authToken');
    const userStr = sessionStorage.getItem('authUser');
    const user = userStr ? JSON.parse(userStr) : null;

    const authForm = document.getElementById('authForm');
    const profileArea = document.getElementById('profile-area');
    const userNameElement = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');

    // elements referenced in toggle dropdown - query them explicitly
    const greeting = document.getElementById('greeting');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (token && user) {
        if (authForm) authForm.style.display = 'none';
        if (profileArea) profileArea.style.display = 'block';
        if (userNameElement) userNameElement.textContent = user.fullName || user.email || '';
    } else {
        if (authForm) authForm.style.display = 'block';
        if (profileArea) profileArea.style.display = 'none';
    }

    // single attach: remove previous handlers if any (avoid double attach)
    if (logoutBtn) {
        logoutBtn.replaceWith(logoutBtn.cloneNode(true));
        const newLogout = document.getElementById('logoutBtn') || document.querySelector('#logoutBtn');
        if (newLogout) {
            newLogout.addEventListener('click', () => {
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('authUser');
                showAlert({ title: 'Thành công', message: 'Bạn đã logout' });
                setTimeout(() => (window.location.href = 'login.html'), 1000);
            });
        }
    }

    // Toggle dropdown
    if (greeting && profileDropdown) {
        greeting.addEventListener('click', () => {
            const isExpanded = greeting.getAttribute('aria-expanded') === 'true';
            greeting.setAttribute('aria-expanded', String(!isExpanded));
            profileDropdown.setAttribute('aria-hidden', String(isExpanded));
            profileDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!greeting.contains(e.target) && !profileDropdown.contains(e.target)) {
                greeting.setAttribute('aria-expanded', 'false');
                profileDropdown.setAttribute('aria-hidden', 'true');
                profileDropdown.classList.remove('show');
            }
        });
    }

    // Logout with API call (separate handler to avoid double-binding)
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function () {
            const tokenInner = sessionStorage.getItem('authToken');
            if (!tokenInner) {
                showAlert({ title: 'Chưa đăng nhập', message: 'Bạn chưa đăng nhập.' });
                return;
            }

            try {
                const res = await fetch(`${baseAPI}${logoutAPI}`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${tokenInner}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (!res.ok) throw new Error(`Lỗi HTTP: ${res.status}`);
                const data = await res.json();
                if (data.succeeded) {
                    sessionStorage.removeItem('authToken');
                    sessionStorage.removeItem('authUser');
                    showAlert({ title: 'Thành công', message: 'Đã logout thành công.' });
                    setTimeout(() => (window.location.href = 'login.html'), 3000);
                } else {
                    showAlert({ title: 'Thất bại', message: data.message });
                }
            } catch (err) {
                console.error(err);
                showAlert({ title: 'Lỗi', message: 'Đã xảy ra lỗi khi logout.' });
            }
        });
    }
}

// Auto-init on import (so importing the module runs the script like before)
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initHeader());
    } else {
        initHeader();
    }
}