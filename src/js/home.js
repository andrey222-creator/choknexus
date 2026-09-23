// Modo demonstração (somente GitHub Pages): sem backend, sem verificação de sessão.
const MODO_DEMO_PAGES = window.location.hostname.endsWith("github.io");

window.addEventListener("DOMContentLoaded", async () => {
    if (MODO_DEMO_PAGES) {
        return;
    }

    try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.ok) {
            window.location.href = "index.html";
        }
    } catch (error) {
        window.location.href = "index.html";
    }
});
