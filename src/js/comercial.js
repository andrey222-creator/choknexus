// =================================
// ELEMENTOS
// =================================

const btnNexus = document.getElementById("btnNexus");
const btnMetas = document.getElementById("btnMetas");
const carrossel = document.getElementById("carrosselComercial");
const slidesEl = document.getElementById("carrosselSlides");
const dotsEl = document.getElementById("carrosselDots");
const btnPrev = document.getElementById("carrosselPrev");
const btnNext = document.getElementById("carrosselNext");

// GitHub Pages hospeda só o frontend: os dados vêm do backend ChokNexus local
// (mesma máquina), autenticado. Localmente, URLs relativas.
const MODO_DEMO_PAGES = window.location.hostname.endsWith("github.io");
const BACKEND_BASE = MODO_DEMO_PAGES ? "http://localhost:3311" : "";
const PAGES_COMERCIAL_URL = "https://andrey222-creator.github.io/choknexus/comercial.html";

function apiUrl(caminho) {
    return BACKEND_BASE + caminho;
}


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

    // GitHub Pages não hospeda o Metas: apenas encaminha para o ChokNexus local.
    window.location.href = apiUrl("/apps/metas");

});


// =================================
// CARROSSEL — QUADROS DO METAS
// =================================

// Ordem fixa dos slides (mesma de quadrosComercial no Vendas).
const ORDEM_QUADROS = [
    "vendas-meta",
    "margem-meta",
    "cupons-fluxo",
    "ticket-medio",
    "vendas",
    "produtividade",
    "vendas-consolidadas",
    "fornecedores"
];

const INTERVALO_SLIDE_MS = 10 * 1000;
const INTERVALO_REFRESH_MS = 5 * 60 * 1000;
const ESCALA_MAXIMA = 2;

const MSG_CARREGANDO = "Carregando...";
const MSG_INDISPONIVEL = "Dados temporariamente indisponíveis.";
const MSG_OFFLINE = "ChokNexus local indisponível.";
const MSG_SEM_SESSAO = "Faça login no ChokNexus local.";

const TONS = ["positive", "negative", "neutral"];
const COR_HEX = /^#[0-9a-fA-F]{3,8}$/;

let slides = [];
let indiceAtual = 0;
let timerSlide = null;
let pausado = false;


// ---------- construção segura (createElement + textContent) ----------

function textoDe(celula) {
    if (celula == null) return "";
    return String(typeof celula === "object" ? celula.text : celula);
}

function criarMensagem(texto) {
    const p = document.createElement("p");
    p.className = "carrossel-mensagem";
    p.textContent = texto;
    return p;
}

function aplicarSpans(el, celula) {
    if (celula && typeof celula === "object") {
        if (Number.isInteger(celula.colSpan) && celula.colSpan > 1) el.colSpan = celula.colSpan;
        if (Number.isInteger(celula.rowSpan) && celula.rowSpan > 1) el.rowSpan = celula.rowSpan;
    }
}

// Colunas onde começa um agrupamento (CONSOLIDADO / VAREJO / ...):
// recebem a linha tracejada do quadro original.
function colunasInicioGrupo(headerRows) {
    const inicios = new Set();
    if (headerRows.length < 2) return inicios;
    let col = 0;
    headerRows[0].forEach((c) => {
        const span = (c && typeof c === "object" && c.colSpan) || 1;
        if (col > 0 && span > 1) inicios.add(col);
        col += span;
    });
    return inicios;
}

// No Pages o logo vem do backend local via fetch CORS com credenciais
// (a rota exige Origin do Pages); localmente, <img> direto.
function carregarLogo(img, caminho) {
    if (!MODO_DEMO_PAGES) {
        img.src = caminho;
        return;
    }
    fetch(apiUrl(caminho), { credentials: "include" })
        .then((resp) => (resp.ok ? resp.blob() : Promise.reject()))
        .then((blob) => {
            img.addEventListener("load", () => URL.revokeObjectURL(img.src), { once: true });
            img.src = URL.createObjectURL(blob);
        })
        .catch(() => img.remove());
}

function criarCelulaCorpo(celula, coluna, inicios) {
    const td = document.createElement("td");
    const texto = textoDe(celula);

    if (inicios.has(coluna)) td.classList.add("inicio-grupo");

    if (celula && typeof celula === "object") {
        aplicarSpans(td, celula);

        if (celula.logo && celula.logo.campanhaId) {
            const img = document.createElement("img");
            img.className = "quadro-logo";
            img.alt = "";
            img.addEventListener("error", () => img.remove());
            img.addEventListener("load", () => ajustarTodos());
            carregarLogo(img, "/api/comercial/campanha/" + encodeURIComponent(celula.logo.campanhaId) + "/logo");
            td.appendChild(img);

            const span = document.createElement("span");
            span.className = "quadro-logo-texto";
            span.textContent = texto;
            td.appendChild(span);
            return td;
        }

        if (TONS.includes(celula.tone)) {
            const pill = document.createElement("span");
            pill.className = "pill " + celula.tone;
            pill.textContent = texto;
            td.appendChild(pill);
            return td;
        }

        if (typeof celula.color === "string" && COR_HEX.test(celula.color)) {
            td.style.color = celula.color;
            td.classList.add("destaque");
        }
    }

    td.textContent = texto;
    return td;
}

function criarQuadro(q) {
    const quadro = document.createElement("div");
    quadro.className = "quadro";

    const titulo = document.createElement("div");
    titulo.className = "quadro-titulo";
    titulo.textContent = textoDe(q.titulo);
    if (q.subtitulo) {
        const sub = document.createElement("span");
        sub.className = "quadro-subtitulo";
        sub.textContent = String(q.subtitulo);
        titulo.appendChild(sub);
    }
    quadro.appendChild(titulo);

    const headerRows = Array.isArray(q.headerRows) ? q.headerRows : [];
    const inicios = colunasInicioGrupo(headerRows);

    const table = document.createElement("table");
    table.className = "quadro-tabela";

    const thead = document.createElement("thead");
    headerRows.forEach((linha, i) => {
        const tr = document.createElement("tr");
        if (headerRows.length > 1 && i < headerRows.length - 1) tr.className = "grupo";
        let col = 0;
        (Array.isArray(linha) ? linha : []).forEach((celula) => {
            const th = document.createElement("th");
            th.textContent = textoDe(celula);
            aplicarSpans(th, celula);
            if (i === headerRows.length - 1 && inicios.has(col)) th.classList.add("inicio-grupo");
            if (i < headerRows.length - 1 && col > 0 && th.colSpan > 1) th.classList.add("inicio-grupo");
            col += th.colSpan || 1;
            tr.appendChild(th);
        });
        thead.appendChild(tr);
    });
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    (Array.isArray(q.rows) ? q.rows : []).forEach((row) => {
        const tr = document.createElement("tr");
        if (row && (row.tipo === "subtotal" || row.tipo === "total")) tr.className = row.tipo;
        let col = 0;
        ((row && Array.isArray(row.cells)) ? row.cells : []).forEach((celula) => {
            const td = criarCelulaCorpo(celula, col, inicios);
            col += td.colSpan || 1;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    quadro.appendChild(table);
    return quadro;
}


// ---------- escala proporcional: quadro inteiro, o maior possível ----------

function ajustarQuadro(slide) {
    const quadro = slide.querySelector(".quadro");
    if (!quadro) return;

    quadro.style.transform = "none";
    const w = quadro.offsetWidth;
    const h = quadro.offsetHeight;
    const areaW = slide.clientWidth;
    const areaH = slide.clientHeight;
    if (!w || !h || !areaW || !areaH) return;

    const escala = Math.min(areaW / w, areaH / h, ESCALA_MAXIMA);
    const left = Math.max(0, (areaW - w * escala) / 2);
    const top = Math.max(0, (areaH - h * escala) / 2);
    quadro.style.transform = `translate(${left}px, ${top}px) scale(${escala})`;
}

function ajustarTodos() {
    slides.forEach(ajustarQuadro);
}

window.addEventListener("resize", ajustarTodos);


// ---------- navegação / autoplay ----------

function agendarProximo() {
    clearTimeout(timerSlide);
    if (pausado || slides.length < 2) return;
    timerSlide = setTimeout(() => irPara(indiceAtual + 1), INTERVALO_SLIDE_MS);
}

function irPara(i) {
    if (!slides.length) return;
    indiceAtual = (i + slides.length) % slides.length;
    slides.forEach((s, k) => {
        s.classList.toggle("ativo", k === indiceAtual);
        s.setAttribute("aria-hidden", k === indiceAtual ? "false" : "true");
    });
    Array.from(dotsEl.children).forEach((d, k) => {
        d.classList.toggle("ativo", k === indiceAtual);
        d.setAttribute("aria-current", k === indiceAtual ? "true" : "false");
    });
    agendarProximo();
}

function montarSlides(conteudos) {
    slidesEl.replaceChildren();
    dotsEl.replaceChildren();
    slides = conteudos.map((conteudo, i) => {
        const slide = document.createElement("div");
        slide.className = "carrossel-slide";
        slide.dataset.quadro = ORDEM_QUADROS[i];
        slide.appendChild(conteudo);
        slidesEl.appendChild(slide);

        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carrossel-dot";
        dot.setAttribute("aria-label", "Quadro " + (i + 1));
        dot.addEventListener("click", () => irPara(i));
        dotsEl.appendChild(dot);

        return slide;
    });
    ajustarTodos();
    irPara(Math.min(indiceAtual, slides.length - 1));
}

function mostrarMensagemUnica(texto) {
    montarSlides(ORDEM_QUADROS.map(() => criarMensagem(texto)));
}

btnPrev.addEventListener("click", () => irPara(indiceAtual - 1));
btnNext.addEventListener("click", () => irPara(indiceAtual + 1));

carrossel.addEventListener("mouseenter", () => {
    pausado = true;
    clearTimeout(timerSlide);
});

carrossel.addEventListener("mouseleave", () => {
    pausado = false;
    agendarProximo();
});


// ---------- dados ----------

function renderizarQuadros(quadros) {
    montarSlides(ORDEM_QUADROS.map((id) => {
        const q = quadros.find((x) => x && x.id === id);
        if (!q || q.erro || !Array.isArray(q.rows)) return criarMensagem(MSG_INDISPONIVEL);
        return criarQuadro(q);
    }));
}

let jaRenderizou = false;

// Evita redirect infinito Pages ↔ login local (ex.: cookie bloqueado no navegador).
// Apenas marca de navegação; não guarda nada de autenticação.
const CHAVE_REDIRECT_LOGIN = "choknexus_redirect_login";
const JANELA_REDIRECT_MS = 2 * 60 * 1000;

function redirecionouHaPouco() {
    try {
        const t = Number(sessionStorage.getItem(CHAVE_REDIRECT_LOGIN));
        return t > 0 && Date.now() - t < JANELA_REDIRECT_MS;
    } catch (_e) {
        return false;
    }
}

function marcarRedirect(valor) {
    try {
        if (valor) sessionStorage.setItem(CHAVE_REDIRECT_LOGIN, String(valor));
        else sessionStorage.removeItem(CHAVE_REDIRECT_LOGIN);
    } catch (_e) { /* sem sessionStorage: segue sem a proteção */ }
}

function irParaLogin() {
    if (!MODO_DEMO_PAGES) {
        window.location.href = "/";
        return;
    }
    if (redirecionouHaPouco()) {
        if (!jaRenderizou) mostrarMensagemUnica(MSG_SEM_SESSAO);
        return;
    }
    marcarRedirect(Date.now());
    window.location.href = apiUrl("/?returnUrl=" + encodeURIComponent(PAGES_COMERCIAL_URL));
}

async function carregarResumo() {
    let resp;
    try {
        resp = await fetch(apiUrl("/api/comercial/resumo"), { credentials: "include" });
    } catch (_err) {
        // Backend local fora do ar (ou acesso local não permitido pelo navegador).
        if (!jaRenderizou) mostrarMensagemUnica(MODO_DEMO_PAGES ? MSG_OFFLINE : MSG_INDISPONIVEL);
        return;
    }

    if (resp.status === 401) {
        irParaLogin();
        return;
    }

    try {
        if (!resp.ok) throw new Error("indisponivel");

        const dados = await resp.json();
        if (!Array.isArray(dados.quadrosComercial)) throw new Error("indisponivel");

        renderizarQuadros(dados.quadrosComercial);
        jaRenderizou = true;
        marcarRedirect(null);
    } catch (_err) {
        // Na atualização periódica, mantém os quadros já exibidos.
        if (!jaRenderizou) mostrarMensagemUnica(MSG_INDISPONIVEL);
    }
}

mostrarMensagemUnica(MSG_CARREGANDO);
carregarResumo();
setInterval(carregarResumo, INTERVALO_REFRESH_MS);
