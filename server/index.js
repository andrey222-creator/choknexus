#!/usr/bin/env node
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG, withConnection } from "./db.js";
import { autenticar, checkRateLimit, registrarTentativa } from "./auth.js";
import { obterResumoComercial, obterLogoCampanha } from "./comercial.js";
import { registrarMetas } from "./metas.js";
import {
  criarSessao,
  obterSessao,
  destruirSessao,
  lerCookieSessao,
  setCookieSessao,
  limparCookieSessao,
} from "./session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const app = express();
const PORT = process.env.PORT || 3311;

// Metas & Atingimentos (proxy protegido para o Vendas) antes do express.json:
// o corpo é repassado sem parse/limite.
registrarMetas(app, { requireAuthPage, requireAuthApi });

app.use(express.json({ limit: "1kb" }));
app.use("/src", express.static(path.join(rootDir, "src")));

function ehHttps(req) {
  return req.secure || req.headers["x-forwarded-proto"] === "https";
}

function requireAuthPage(req, res, next) {
  const sessionId = lerCookieSessao(req);
  const sessao = obterSessao(sessionId);
  if (!sessao) {
    return res.redirect("/");
  }
  next();
}

function requireAuthApi(req, res, next) {
  const sessionId = lerCookieSessao(req);
  const sessao = obterSessao(sessionId);
  if (!sessao) {
    return res.status(401).json({ ok: false, erro: "Não autenticado" });
  }
  next();
}

const MENSAGEM_CREDENCIAL_INVALIDA = "Usuário ou senha inválidos.";

app.post("/api/auth/login", async (req, res) => {
  const { usuario, senha } = req.body || {};
  const chaveRateLimit = `${req.ip}:${String(usuario || "").trim().toUpperCase()}`;

  const { limitado } = checkRateLimit(chaveRateLimit);
  if (limitado) {
    return res.status(429).json({
      ok: false,
      message: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    });
  }

  if (!usuario || !senha) {
    return res.status(400).json({ ok: false, message: MENSAGEM_CREDENCIAL_INVALIDA });
  }

  try {
    const resultado = await autenticar(usuario, senha);
    registrarTentativa(chaveRateLimit, resultado.ok);

    if (!resultado.ok) {
      return res.status(401).json({ ok: false, message: MENSAGEM_CREDENCIAL_INVALIDA });
    }

    const sessionId = criarSessao(resultado.usuario);
    setCookieSessao(res, sessionId, ehHttps(req));
    return res.json({ ok: true, usuario: { nome: resultado.usuario.nome } });
  } catch (err) {
    console.error("[auth/login] erro interno:", err.message);
    return res.status(500).json({ ok: false, message: "Erro interno. Tente novamente." });
  }
});

app.get("/api/auth/me", (req, res) => {
  const sessionId = lerCookieSessao(req);
  const sessao = obterSessao(sessionId);
  if (!sessao) {
    return res.status(401).json({ ok: false });
  }
  return res.json({ ok: true, usuario: { idUsuario: sessao.idUsuario, nome: sessao.nome } });
});

app.post("/api/auth/logout", (req, res) => {
  const sessionId = lerCookieSessao(req);
  destruirSessao(sessionId);
  limparCookieSessao(res, ehHttps(req));
  return res.json({ ok: true });
});

app.get("/api/arius/health", async (_req, res) => {
  try {
    const result = await withConnection((conn) =>
      conn.execute("SELECT 1 AS OK FROM DUAL")
    );
    res.json({
      status: "ok",
      schema: CONFIG.schema,
      oracle: result.rows?.[0]?.OK === 1,
    });
  } catch (err) {
    res.status(500).json({ status: "erro", mensagem: err.message });
  }
});

app.get("/api/comercial/resumo", requireAuthApi, async (_req, res) => {
  const resultado = await obterResumoComercial();
  if (!resultado.ok) {
    console.error("[api/comercial/resumo] erro interno:", resultado.motivo);
    return res.status(resultado.status).json({
      ok: false,
      erro: "Dados comerciais indisponíveis no momento.",
    });
  }
  return res.json({ ok: true, ...resultado.resumo });
});

app.get("/api/comercial/campanha/:campanhaId/logo", requireAuthApi, async (req, res) => {
  const resultado = await obterLogoCampanha(req.params.campanhaId);
  if (!resultado.ok) {
    if (resultado.motivo) console.error("[api/comercial/logo] erro interno:", resultado.motivo);
    return res.status(resultado.status === 404 ? 404 : resultado.status).end();
  }
  res.set("Content-Type", resultado.mime);
  res.set("Cache-Control", "private, max-age=300");
  res.set("X-Content-Type-Options", "nosniff");
  return res.send(resultado.buffer);
});

app.get(["/", "/index.html"], (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.get("/comercial.html", requireAuthPage, (_req, res) => {
  res.sendFile(path.join(rootDir, "comercial.html"));
});

app.get("/home.html", requireAuthPage, (_req, res) => {
  res.sendFile(path.join(rootDir, "home.html"));
});

// Somente local (não expor na rede).
const HOST = process.env.HOST || "127.0.0.1";

app.listen(PORT, HOST, () => {
  console.log(`[chokNexus-server] rodando em http://${HOST}:${PORT}`);
});
