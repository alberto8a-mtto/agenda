const THEME_STORAGE_KEY = "revisiones_theme_mode_v1";
const THEME_OPTIONS = ["system", "light", "dark"];

function getStoredThemeMode() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (THEME_OPTIONS.includes(stored)) return stored;
    return "system";
}

function getResolvedColorScheme(mode) {
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeMode(mode) {
    const finalMode = THEME_OPTIONS.includes(mode) ? mode : "system";
    document.documentElement.setAttribute("data-theme", finalMode);
    document.documentElement.style.colorScheme = getResolvedColorScheme(finalMode);
    localStorage.setItem(THEME_STORAGE_KEY, finalMode);

    document.querySelectorAll("[data-theme-select]").forEach((select) => {
        if (select.value !== finalMode) {
            select.value = finalMode;
        }
    });
}

function initializeThemeSelectors() {
    const selects = document.querySelectorAll("[data-theme-select]");
    const currentMode = getStoredThemeMode();

    selects.forEach((select) => {
        select.value = currentMode;
        select.addEventListener("change", (event) => {
            applyThemeMode(event.target.value);
        });
    });

    applyThemeMode(currentMode);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", () => {
        if (getStoredThemeMode() === "system") {
            applyThemeMode("system");
        }
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeThemeSelectors);
} else {
    initializeThemeSelectors();
}
