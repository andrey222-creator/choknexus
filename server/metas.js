import http from "node:http";

// Metas & Atingimentos: o projeto Vendas (local-refresh-server.js) continua
// sendo a fonte única. O ChokNexus só valida a sessão Arius e encaminha para
// o serviço Vendas, em destino FIXO definido no servidor (nunca pelo usuário).
const VENDAS = new URL(process.env.VENDAS_METAS_URL || "http://127.0.0.1:5175");
const PAINEL_PATH = "/acompanhamento_comercial_excel/Painel%20Comercial.html";
const ASSETS_PATH = "/acompanhamento_comercial_excel/";
const BASE = "/apps/metas";

// Somente os recursos que o relatório usa (CHOKNEXUS_INTEGRATION.md, seções 6 e 8).
const ASSETS = new Set([
  "logo-chokdoce.png",
  "logo-chokdoce-favicon.png",
  "logo_choknexus.png",
  "logo_metas_atingimentos.png",
]);

const APIS = new Set([
  "GET /api/health",
  "POST /api/ensure-period",
  "POST /api/refresh",
  "GET /api/state",
  "POST /api/state",
  "POST /api/marketplace",
  "POST /api/marketplace/remove",
  "GET /api/magalu-full",
  "POST /api/magalu-full/atualizar",
  "GET /api/campanha/paodemel-rp",
  "GET /api/campanha/buscar",
  "GET /api/campanha/base",
  "POST /api/alertar-erro",
  "GET /api/gerar-relatorio-pdf",
  "GET /api/margem-historica",
  "GET /api/orientador/departamentos",
  "GET /api/orientador/ranking",
]);

const ERRO_GENERICO = { ok: false, error: "Serviço temporariamente indisponível." };

function requisitarVendas(metodo, caminho, headers, corpo, aoResponder, aoFalhar) {
  const req = http.request(
    { protocol: VENDAS.protocol, hostname: VENDAS.hostname, port: VENDAS.port, method: metodo, path: caminho, headers },
    aoResponder
  );
  req.on("error", aoFalhar);
  if (corpo) corpo.pipe(req);
  else req.end();
}

function erroJson(res, status = 503) {
  if (!res.headersSent) res.status(status).json(ERRO_GENERICO);
  else res.end();
}

// Ajustes mínimos, só em memória, para o relatório rodar sob /apps/metas.
function adaptarHtml(html) {
  const voltar =
    "<script>(function(){var l=document.querySelector('.fixed-logo-right');if(!l)return;" +
    "l.style.cursor='pointer';l.title='Voltar ao ChokNexus';" +
    "l.addEventListener('click',function(){location.href='/comercial.html';});})();</script>";
  return html
    .replace(/(['"`])\/api\//g, `$1${BASE}/api/`)
    .replace(/((?:src|href)=["'])(logo[\w-]*\.png)(["'])/g, `$1${BASE}/assets/$2$3`)
    .replace(/function isLocalServerContext\(\)\{/g, "function isLocalServerContext(){ return true;")
    .replace(/<\/body>(?![\s\S]*<\/body>)/, voltar + "</body>");
}

export function registrarMetas(app, { requireAuthPage, requireAuthApi }) {
  app.get(BASE, requireAuthPage, (_req, res) => {
    requisitarVendas("GET", PAINEL_PATH, {}, null, (up) => {
      if (up.statusCode !== 200) {
        up.resume();
        console.error("[apps/metas] vendas respondeu", up.statusCode);
        return res.status(503).type("text/plain").send("Relatório temporariamente indisponível.");
      }
      const partes = [];
      up.on("data", (c) => partes.push(c));
      up.on("end", () => {
        res.set("Cache-Control", "no-store");
        res.type("html").send(adaptarHtml(Buffer.concat(partes).toString("utf8")));
      });
    }, (err) => {
      console.error("[apps/metas] vendas indisponível:", err.code || err.message);
      res.status(503).type("text/plain").send("Relatório temporariamente indisponível.");
    });
  });

  app.get(`${BASE}/assets/:nome`, requireAuthApi, (req, res) => {
    if (!ASSETS.has(req.params.nome)) return res.status(404).end();
    requisitarVendas("GET", ASSETS_PATH + req.params.nome, {}, null, (up) => {
      if (up.statusCode !== 200) {
        up.resume();
        return res.status(404).end();
      }
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "private, max-age=300");
      up.pipe(res);
    }, () => res.status(503).end());
  });

  app.all(`${BASE}/api/*`, requireAuthApi, (req, res) => {
    const u = new URL(req.originalUrl, "http://x");
    const rota = "/api/" + u.pathname.slice(`${BASE}/api/`.length);
    if (!APIS.has(`${req.method} ${rota}`)) return res.status(404).json({ ok: false });

    // Não repassa cookies (choknexus_sid) nem demais cabeçalhos do navegador.
    const headers = {};
    if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
    if (req.headers["content-length"]) headers["content-length"] = req.headers["content-length"];

    requisitarVendas(req.method, rota + u.search, headers, req.method === "POST" ? req : null, (up) => {
      if (up.statusCode >= 500) {
        // Erro do Vendas pode conter mensagem técnica/caminho local: não repassar.
        up.resume();
        console.error("[apps/metas/api]", rota, "vendas respondeu", up.statusCode);
        return erroJson(res, 502);
      }
      res.status(up.statusCode);
      if (up.headers["content-type"]) res.set("Content-Type", up.headers["content-type"]);
      if (up.headers["content-disposition"]) res.set("Content-Disposition", up.headers["content-disposition"]);
      res.set("Cache-Control", "no-store");
      up.pipe(res);
    }, (err) => {
      console.error("[apps/metas/api]", rota, "vendas indisponível:", err.code || err.message);
      erroJson(res);
    });
  });
}
