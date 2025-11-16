document.addEventListener("DOMContentLoaded", function () {

    const BaseAPI = 'https://localhost:7108/api/auth';
    const registerAPI = "/register";
    const verifyAPI = "/verify-otp";
    const resetAPI = "/reset-password";
    const loginAPI = "/login";
    const logoutAPI = "/logout";
    const forgotAPI = "/forgot-password";

    const registerForm = document.getElementById("registerForm");
    const otpForm = document.getElementById("otpForm");
    const loginForm = document.getElementById("loginForm");
    const forgotForm = document.getElementById("forgotForm");
    const resetForm = document.getElementById("resetForm");
    const logoutBtn = document.getElementById("logoutBtn");

    function showAlert({ title = "", message = "" } = {}) {
        if (title && message) alert(title + "\n\n" + message);
        else if (title) alert(title);
        else alert(message || "");
    }

    function fetchJson(url, options) {
        return fetch(url, options)
            .then(async response => {
                let data;
                try {
                    data = await response.json(); // parse JSON
                } catch {
                    data = {}; // trường hợp body không phải JSON
                }

                if (!response.ok) {
                    // lấy message từ body nếu có, fallback ra status
                    const msg = data?.message || `HTTP Error: ${response.status}`;
                    throw new Error(msg);
                }
                return data;
            });
    }


    // ---- REGISTER ----
    if (registerForm) {
        registerForm.addEventListener("submit", function (e) {
            e.preventDefault();
            const payload = {
                fullName: document.getElementById("registerFullName").value.trim(),
                email: document.getElementById("registerEmail").value.trim(),
                password: document.getElementById("registerPassword").value
            };

            fetchJson(`${BaseAPI}${registerAPI}`, {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
                .then(data => {
                    showAlert({ title: data.succeeded ? "Thành công!" : "Thất bại!", message: data.message });
                    if (data.succeeded) {
                        sessionStorage.setItem("authEmail", payload.email);
                        sessionStorage.setItem("userTokenType", "VerifyEmail");
                        window.location.href = "otp.html";
                    }
                })
                .catch(err => showAlert({ title: "Lỗi!", message: err.message }));
        });
    }

    // ---- VERIFY OTP ----
    if (otpForm) {
        otpForm.addEventListener("submit", function (e) {
            e.preventDefault();
            const payload = {
                email: sessionStorage.getItem("authEmail"),
                otp: document.getElementById("otpInput").value.trim(),
                type: sessionStorage.getItem("userTokenType")
            };

            fetchJson(`${BaseAPI}${verifyAPI}`, {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
                .then(data => {
                    showAlert({ title: data.succeeded ? "Thành công!" : "Thất bại!", message: data.message });
                    if (data.succeeded) {
                        if (payload.type === "ResetPassword") {
                            const container = document.getElementById('container');
                            if (container) container.classList.add("right-panel-active");
                        } else {
                            window.location.href = 'index.html';
                            sessionStorage.removeItem("authEmail");
                            sessionStorage.removeItem("userTokenType");
                        }
                    }
                })
                .catch(err => showAlert({ title: "Lỗi!", message: err.message }));
        });
    }

    // ---- LOGIN ----
    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();
            const payload = {
                email: document.getElementById("loginEmail").value.trim(),
                password: document.getElementById("loginPassword").value
            };

            fetchJson(`${BaseAPI}${loginAPI}`, {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
                .then(data => {
                    showAlert({ title: data.succeeded ? "Thành công!" : "Login thất bại", message: data.message });
                    if (data.succeeded) {
                        sessionStorage.setItem("authToken", data.data.token);
                        sessionStorage.setItem("authUser", JSON.stringify(data.data.user));
                        window.location.href = "homepage.html";
                    }
                })
                .catch(err => showAlert({ title: "Lỗi!", message: err.message }));
        });
    }

    // ---- LOGOUT ----
    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            const token = sessionStorage.getItem("authToken");
            if (!token) {
                showAlert({ title: "Chưa đăng nhập", message: "Bạn chưa đăng nhập." });
                return;
            }

            fetchJson(`${BaseAPI}${logoutAPI}`, {
                method: 'POST',
                headers: { "Authorization": `Bearer ${token}` }
            })
                .then(data => {
                    showAlert({ title: data.succeeded ? "Thành công" : "Thất bại", message: data.message });
                    if (data.succeeded) {
                        sessionStorage.removeItem("authToken");
                        sessionStorage.removeItem("authUser");
                        window.location.href = "login.html";
                    }
                })
                .catch(err => showAlert({ title: "Lỗi", message: err.message }));
        });
    }

    // ---- FORGOT PASSWORD ----
    if (forgotForm) {
        forgotForm.addEventListener("submit", function (e) {
            e.preventDefault();
            const payload = { email: document.getElementById("forgotEmail").value.trim() };

            fetchJson(`${BaseAPI}${forgotAPI}`, {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
                .then(data => {
                    showAlert({ title: data.succeeded ? "OTP đã gửi" : "Thất bại", message: data.message });
                    if (data.succeeded) {
                        sessionStorage.setItem("authEmail", payload.email);
                        sessionStorage.setItem("userTokenType", "ResetPassword");
                        window.location.href = "otp.html";
                    }
                })
                .catch(err => showAlert({ title: "Lỗi", message: err.message }));
        });
    }

    // ---- RESET PASSWORD ----
    if (resetForm) {
        resetForm.addEventListener("submit", function (e) {
            e.preventDefault();
            const email = sessionStorage.getItem("authEmail");
            const newPassword = document.getElementById("newPassword").value;
            const reEnterNewPassword = document.getElementById("reEnterNewPassword").value;

            if (newPassword !== reEnterNewPassword) {
                showAlert({ title: "Thất bại", message: "Mật khẩu và nhập lại mật khẩu không khớp!" });
                return;
            }

            const payload = { email, newPassword };

            fetchJson(`${BaseAPI}${resetAPI}`, {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
                .then(data => {
                    showAlert({ title: data.succeeded ? "Thành công" : "Thất bại", message: data.message });
                    if (data.succeeded) {
                        sessionStorage.removeItem("authEmail");
                        sessionStorage.removeItem("userTokenType");
                        window.location.href = "login.html";
                    }
                })
                .catch(err => showAlert({ title: "Lỗi", message: err.message }));
        });
    }

});
