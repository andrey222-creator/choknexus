window.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.ok) {
            window.location.href = "/index.html";
        }
    } catch (error) {
        window.location.href = "/index.html";
    }
});
