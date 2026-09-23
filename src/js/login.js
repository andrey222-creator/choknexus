// =================================
// ELEMENTOS
// =================================

const loginForm = document.getElementById("loginForm");
const usuarioInput = document.getElementById("usuario");
const senhaInput = document.getElementById("senha");
const btnEntrar = document.getElementById("btnEntrar");
const loginMessage = document.getElementById("loginMessage");


// =================================
// ESTADO
// =================================

let loginEmAndamento = false;

// Modo demonstração (somente GitHub Pages): não há backend; nenhuma credencial é enviada.
const MODO_DEMO_PAGES = window.location.hostname.endsWith("github.io");


// =================================
// FOCO INICIAL
// =================================

window.addEventListener("DOMContentLoaded", () => {
    usuarioInput.focus();
});


// =================================
// ENTER NO CAMPO USUÁRIO
// =================================

usuarioInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {

        event.preventDefault();

        if (usuarioInput.value.trim() === "") {
            usuarioInput.focus();
            return;
        }

        senhaInput.focus();
    }

});


// =================================
// ENVIO DO LOGIN
// =================================

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    // Evita múltiplos cliques
    if (loginEmAndamento) {
        return;
    }

    const usuario = usuarioInput.value.trim();
    const senha = senhaInput.value;

    // Limpa mensagem anterior
    loginMessage.textContent = "";


    // =================================
    // VALIDAÇÕES
    // =================================

    if (!usuario) {

        loginMessage.textContent = "Informe o usuário.";
        usuarioInput.focus();

        return;
    }

    if (!senha) {

        loginMessage.textContent = "Informe a senha.";
        senhaInput.focus();

        return;
    }

    if (MODO_DEMO_PAGES) {
        senhaInput.value = "";
        loginMessage.textContent =
            "Modo demonstração: login Arius indisponível no GitHub Pages.";
        window.location.href = "home.html";
        return;
    }


    // =================================
    // INICIA LOGIN
    // =================================

    loginEmAndamento = true;

    btnEntrar.disabled = true;
    btnEntrar.textContent = "Entrando...";

    usuarioInput.disabled = true;
    senhaInput.disabled = true;


    try {

        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ usuario, senha })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.ok) {
            loginMessage.textContent =
                data.message || "Não foi possível realizar o login.";
            senhaInput.value = "";
            senhaInput.focus();
            return;
        }

        loginMessage.textContent = "Login realizado com sucesso.";
        window.location.href = "home.html";
        return;

    } catch (error) {

        console.error("Erro no login:", error);

        loginMessage.textContent =
            "Não foi possível realizar o login.";

    } finally {

        loginEmAndamento = false;

        btnEntrar.disabled = false;
        btnEntrar.textContent = "Entrar";

        usuarioInput.disabled = false;
        senhaInput.disabled = false;

    }

});