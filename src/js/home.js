// Modo demonstração (somente GitHub Pages): sem backend.
const MODO_DEMO_PAGES = window.location.hostname.endsWith("github.io");

window.addEventListener("DOMContentLoaded", async () => {

    const btnSair = document.getElementById("btnSair");


    // =================================
    // LOGOUT
    // =================================

    btnSair.addEventListener("click", async () => {

        btnSair.disabled = true;
        btnSair.textContent = "Saindo...";

        // GitHub Pages não possui backend
        if (MODO_DEMO_PAGES) {
            window.location.href = "index.html";
            return;
        }

        try {

            await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include"
            });

        } catch (error) {

            console.error("Erro ao encerrar sessão:", error);

        } finally {

            window.location.href = "index.html";

        }

    });


    // =================================
    // VERIFICAÇÃO DE SESSÃO
    // =================================

    if (MODO_DEMO_PAGES) {
        return;
    }

    try {

        const response = await fetch("/api/auth/me", {
            credentials: "include"
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.ok) {
            window.location.href = "index.html";
        }

    } catch (error) {

        window.location.href = "index.html";

    }

});