const AUTH_STORAGE_KEY = "revisiones_auth_config_v1";
const SESSION_STORAGE_KEY = "revisiones_active_session_v1";
const DEFAULT_AUTH_CONFIG = {
    users: [
        { id: "u_admin", fullName: "Administrador", username: "admin", password: "1234", role: "ADMIN", company: "TODAS", blocked: false },
        { id: "u_coord", fullName: "Coordinador", username: "coordinador", password: "1234", role: "COORDINADOR", company: "TODAS", blocked: false }
    ]
};

let authConfig = { users: [] };

function persistAuthConfig() {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authConfig));
}

function loadAuthConfig() {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) {
        authConfig = { users: DEFAULT_AUTH_CONFIG.users.map(u => ({ ...u })) };
        persistAuthConfig();
        return;
    }
    try {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.users) && parsed.users.length) {
            authConfig = {
                users: parsed.users
                    .filter(u => u && typeof u.username === "string" && typeof u.password === "string")
                    .map(u => ({ ...u, fullName: (typeof u.fullName === "string" && u.fullName.trim()) ? u.fullName.trim() : u.username, blocked: u.blocked === true }))
            };
            return;
        }
        authConfig = { users: DEFAULT_AUTH_CONFIG.users.map(u => ({ ...u })) };
        persistAuthConfig();
    } catch (e) {
        authConfig = { users: DEFAULT_AUTH_CONFIG.users.map(u => ({ ...u })) };
        persistAuthConfig();
    }
}

function showAuthMessage(message, type) {
    const messageBox = document.getElementById("authMessage");
    if (!messageBox) return;
    messageBox.textContent = message;
    messageBox.className = `msg ${type === "error" ? "error-msg" : "success-msg"}`;
    messageBox.style.display = "block";
}

function setSession(userId) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ userId }));
}

function hasActiveSession() {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.userId) return false;
        return authConfig.users.some(u => u.id === parsed.userId);
    } catch (e) {
        return false;
    }
}

function findUser(username, password) {
    const normalized = username.trim().toLowerCase();
    return authConfig.users.find(u => u.username.toLowerCase() === normalized && u.password === password.trim()) || null;
}

function login() {
    const usernameInput = document.getElementById("authUsername");
    const passwordInput = document.getElementById("authPassword");
    const username = usernameInput ? usernameInput.value : "";
    const password = passwordInput ? passwordInput.value : "";

    if (!username.trim() || !password.trim()) {
        showAuthMessage("Ingrese usuario y clave.", "error");
        return;
    }

    const user = findUser(username, password);
    if (!user) {
        showAuthMessage("Usuario o clave incorrectos.", "error");
        return;
    }
    if (user.blocked === true) {
        showAuthMessage("Usuario bloqueado. Solicite restablecimiento a ADMIN o COORDINADOR.", "error");
        return;
    }

    setSession(user.id);
    showAuthMessage("Acceso exitoso. Redirigiendo...", "success");
    window.location.href = "index.html";
}

function initLoginPage() {
    loadAuthConfig();
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
