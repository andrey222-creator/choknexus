// =================================
// ELEMENTOS
// =================================

const btnNexus = document.getElementById("btnNexus");
const btnMetas = document.getElementById("btnMetas");
const painelMetas = document.getElementById("painelMetas");
const painelTrade = document.getElementById("painelTrade");


// =================================
// VOLTAR AO CHOKNEXUS
// =================================

btnNexus.addEventListener("click", () => {

    window.location.href = "home.html";

});


// =================================
// METAS & ATINGIMENTOS (relatório completo)
// =================================

btnMetas.addEventListener("click", () => {

    // GitHub Pages é só demonstração: sem relatório completo.
    if (window.location.hostname.endsWith("github.io")) return;

    window.location.href = "/apps/metas";

});


// =================================
// PAINÉIS
// =================================

const MSG_CARREGANDO = "Carregando...";
const MSG_INDISPONIVEL = "Dados temporariamente indisponíveis.";
const MSG_DEMO = "Disponível no ambiente autenticado.";

function mostrarMensagem(painel, texto) {
    const p = document.createElement("p");
    p.className = "painel-mensagem";
    p.textContent = texto;
    painel.replaceChildren(p);
}

function criarCelula(tag, valor) {
    const cel = document.createElement(tag);
    cel.textContent = valor == null ? "" : String(valor);
    return cel;
}

// headers pode trazer uma linha de grupos antes da linha de colunas
// (ex.: painelFluxoCupons: "", CONSOLIDADO, VAREJO, ... + ChokDoce, 2026, 2025, ...).
function criarCabecalho(headers, colunas) {
    const thead = document.createElement("thead");
    const extras = headers.length - colunas;
    const grupos = extras > 1 ? headers.slice(0, extras) : [];
    const span = grupos.length > 1 ? (colunas - 1) / (grupos.length - 1) : 0;

    if (grupos.length && Number.isInteger(span)) {
        const trGrupo = document.createElement("tr");
        trGrupo.className = "painel-grupo";
        grupos.forEach((g, i) => {
            const th = criarCelula("th", g);
            th.colSpan = i === 0 ? 1 : span;
            trGrupo.appendChild(th);
        });
        thead.appendChild(trGrupo);
        headers = headers.slice(extras);
    }

    const tr = document.createElement("tr");
    headers.forEach((h) => tr.appendChild(criarCelula("th", h)));
    thead.appendChild(tr);
    return thead;
}

function renderizarPainel(painel, dados) {
    const colunas = dados.rows.reduce((m, r) => Math.max(m, r.length), 0) || dados.headers.length;

    const titulo = document.createElement("h2");
    titulo.className = "painel-titulo";
    titulo.textContent = dados.titulo == null ? "" : String(dados.titulo);

    const table = document.createElement("table");
    table.className = "painel-tabela";
    table.appendChild(criarCabecalho(dados.headers, colunas));

    const tbody = document.createElement("tbody");
    dados.rows.forEach((row) => {
        const tr = document.createElement("tr");
        row.forEach((valor) => tr.appendChild(criarCelula("td", valor)));
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    painel.replaceChildren(titulo, table);
}

function painelValido(p) {
    return p && Array.isArray(p.headers) && Array.isArray(p.rows);
}

async function carregarResumo() {
    // GitHub Pages: somente demonstração visual, sem dados comerciais.
    if (window.location.hostname.endsWith("github.io")) {
        mostrarMensagem(painelMetas, MSG_DEMO);
        mostrarMensagem(painelTrade, MSG_DEMO);
        return;
    }

    mostrarMensagem(painelMetas, MSG_CARREGANDO);
    mostrarMensagem(painelTrade, MSG_CARREGANDO);

    try {
        const resp = await fetch("/api/comercial/resumo", { credentials: "include" });

        if (resp.status === 401) {
            window.location.href = "/";
            return;
        }

        if (!resp.ok) throw new Error("indisponivel");

        const dados = await resp.json();
        if (!painelValido(dados.painelVendas) || !painelValido(dados.painelFluxoCupons)) {
            throw new Error("indisponivel");
        }

        renderizarPainel(painelMetas, dados.painelVendas);
        renderizarPainel(painelTrade, dados.painelFluxoCupons);
    } catch (_err) {
        mostrarMensagem(painelMetas, MSG_INDISPONIVEL);
        mostrarMensagem(painelTrade, MSG_INDISPONIVEL);
    }
}

carregarResumo();
