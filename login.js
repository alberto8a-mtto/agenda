const SESSION_STORAGE_KEY = "revisiones_active_session_v1";
let pendingFirstLoginCredentials = null;

async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
        method: options.method || "GET",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    const isJson = (response.headers.get("content-type") || "").includes("application/json");
    const payload = isJson ? await response.json() : null;
    if (!response.ok) {
        const message = payload && payload.error ? payload.error : "Error de red";
        throw new Error(message);
    }
    return payload;
}

function showAuthMessage(message, type) {
    const messageBox = document.getElementById("authMessage");
    if (!messageBox) return;
    messageBox.textContent = message;
    messageBox.className = `msg ${type === "error" ? "error-msg" : "success-msg"}`;
    messageBox.style.display = "block";
}

function setSession(user) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        userId: user.userId,
        username: user.username,
        role: user.role,
        company: user.company
    }));
}

function toggleFirstLoginPasswordChange(show) {
    const section = document.getElementById("authPasswordChangeSection");
    const usernameInput = document.getElementById("authUsername");
    const passwordInput = document.getElementById("authPassword");
    const loginBtn = document.getElementById("authLoginBtn");
    if (section) section.style.display = show ? "block" : "none";
    if (usernameInput) usernameInput.disabled = show;
    if (passwordInput) passwordInput.disabled = show;
    if (loginBtn) loginBtn.style.display = show ? "none" : "inline-flex";
}

async function changePasswordFirstLogin() {
    const newPasswordInput = document.getElementById("authNewPassword");
    const confirmPasswordInput = document.getElementById("authConfirmPassword");
    const newPassword = newPasswordInput ? newPasswordInput.value.trim() : "";
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value.trim() : "";

    if (!pendingFirstLoginCredentials) {
        showAuthMessage("Primero inicie sesión con su clave temporal.", "error");
        return;
    }
    if (!newPassword || !confirmPassword) {
        showAuthMessage("Ingrese y confirme la nueva clave.", "error");
        return;
    }
    if (newPassword.length < 4) {
        showAuthMessage("La nueva clave debe tener al menos 4 caracteres.", "error");
        return;
    }
    if (newPassword !== confirmPassword) {
        showAuthMessage("La confirmación no coincide con la nueva clave.", "error");
        return;
    }
    if (newPassword === pendingFirstLoginCredentials.password) {
        showAuthMessage("La nueva clave debe ser diferente a la temporal.", "error");
        return;
    }

    try {
        const user = await apiRequest("/api/auth/change-password", {
            method: "POST",
            body: {
                username: pendingFirstLoginCredentials.username,
                currentPassword: pendingFirstLoginCredentials.password,
                newPassword
            }
        });

        setSession(user);
        pendingFirstLoginCredentials = null;
        showAuthMessage("Clave actualizada. Redirigiendo...", "success");
        window.location.href = "index.html";
    } catch (error) {
        showAuthMessage(error.message || "No fue posible cambiar la clave.", "error");
    }
}

function hasActiveSession() {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    try {
        const parsed = JSON.parse(raw);
        return !!(parsed && parsed.userId);
    } catch (e) {
        return false;
    }
}

async function login() {
    const usernameInput = document.getElementById("authUsername");
    const passwordInput = document.getElementById("authPassword");
    const username = usernameInput ? usernameInput.value : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!username.trim() || !password.trim()) {
        showAuthMessage("Ingrese usuario y clave.", "error");
        return;
    }

    try {
        const user = await apiRequest("/api/auth/login", {
            method: "POST",
            body: {
                username: username.trim(),
                password: password.trim()
            }
        });

        if (user.mustChangePassword === true) {
            pendingFirstLoginCredentials = {
                username: username.trim(),
                password: password.trim()
            };
            toggleFirstLoginPasswordChange(true);
            showAuthMessage("Debe cambiar su clave temporal para continuar.", "error");
            return;
        }

        setSession(user);
        showAuthMessage("Acceso exitoso. Redirigiendo...", "success");
        window.location.href = "index.html";
    } catch (error) {
        showAuthMessage(error.message || "Usuario o clave incorrectos.", "error");
    }
}

function initLoginPage() {
    if (hasActiveSession()) {
        window.location.href = "index.html";
        return;
    }
    const loginBtn = document.getElementById("authLoginBtn");
    const changePasswordBtn = document.getElementById("authChangePasswordBtn");
    const passwordInput = document.getElementById("authPassword");
    const confirmPasswordInput = document.getElementById("authConfirmPassword");
    toggleFirstLoginPasswordChange(false);
    if (loginBtn) loginBtn.addEventListener("click", login);
    if (changePasswordBtn) changePasswordBtn.addEventListener("click", changePasswordFirstLogin);
    if (passwordInput) {
        passwordInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") login();
        });
    }
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") changePasswordFirstLogin();
        });
    }
}

initLoginPage();
