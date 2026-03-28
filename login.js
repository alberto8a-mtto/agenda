const SESSION_STORAGE_KEY = "revisiones_active_session_v1";

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
    const passwordInput = document.getElementById("authPassword");
    if (loginBtn) loginBtn.addEventListener("click", login);
    if (passwordInput) {
        passwordInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") login();
        });
    }
}

initLoginPage();
