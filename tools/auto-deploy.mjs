#!/usr/bin/env node
// Auto deploy do frontend ChokNexus: observa arquivos estáticos, agrupa
// alterações (debounce), faz commit seletivo e push para origin/main.
// O GitHub Actions continua responsável pela publicação no GitHub Pages.

import { watch } from "node:fs";
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRANCH = "main";
const REMOTE = "origin";
const DEBOUNCE_MS = 5000;
const LOCK_PORT = 3399; // impede duas instâncias do watcher

// Caminhos publicáveis (pathspecs do git).
const PATHSPECS = [
  ":(glob)*.html",
  "src/css",
  "src/js",
  "src/assets",
  ".github/workflows/pages.yml",
];

// Nunca publicar, mesmo que dentro de área permitida.
const PROIBIDO = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)node_modules(\/|$)/i,
  /\.log$/i,
  /^server\//i,
  /^\.git\//i,
  /\.(pem|key|p12|pfx|dmp|dump|tmp)$/i,
  /(^|\/)_[^/]*_temp\./i,
];

const log = (m) => console.log(`[ChokNexus] ${m}`);

function relevante(rel) {
  const p = rel.replace(/\\/g, "/");
  if (PROIBIDO.some((r) => r.test(p))) return false;
  if (/^[^/]+\.html$/i.test(p)) return true;
  if (/^src\/(css|js|assets)\//i.test(p)) return true;
  return p === ".github/workflows/pages.yml";
}

function git(args) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd: ROOT, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message).split(/\r?\n/).map((l) => l.trim())
            .filter((l) => l && !/^(hint|warning):/i.test(l));
          reject(new Error(msg.slice(-2).join(" | ") || "erro desconhecido"));
        } else resolve(stdout);
      });
  });
}

function stamp() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

let timer = null;
let rodando = false;
let pendente = false;

function agendar() {
  if (rodando) { pendente = true; return; }
  clearTimeout(timer);
  timer = setTimeout(deploy, DEBOUNCE_MS);
}

async function deploy() {
  timer = null;
  if (rodando) { pendente = true; return; }
  rodando = true;
  pendente = false;
  try {
    const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
    if (branch !== BRANCH) throw new Error(`branch atual é '${branch}', esperado '${BRANCH}'`);

    const mudancas = (await git(["status", "--porcelain", "-z", "--", ...PATHSPECS]))
      .split("\0").filter(Boolean).map((l) => l.slice(3)).filter(relevante);

    if (mudancas.length) {
      log("Preparando publicação...");
      await git(["add", "-A", "--", ...PATHSPECS]);

      const staged = (await git(["diff", "--cached", "--name-only", "-z", "--", ...PATHSPECS]))
        .split("\0").filter(Boolean);
      const bloqueados = staged.filter((f) => !relevante(f));
      if (bloqueados.length) {
        // Só remove do índice; nunca toca no arquivo em disco.
        await git(["reset", "-q", "--", ...bloqueados]);
      }
      const arquivos = staged.filter(relevante);

      if (arquivos.length) {
        // Commit apenas desses arquivos (ignora o que mais estiver staged).
        await git(["commit", "-q", "-m", `Auto deploy: ${stamp()}`, "--only", "--", ...arquivos]);
        log("Commit criado.");
      }
    }

    const aFrente = Number((await git(["rev-list", "--count", `${REMOTE}/${BRANCH}..HEAD`])).trim());
    if (aFrente > 0) {
      await git(["push", REMOTE, BRANCH]);
      log("Publicado com sucesso.");
    }
  } catch (e) {
    log("Falha ao publicar.");
    console.log(`  ${e.message}`);
  } finally {
    rodando = false;
    if (pendente) agendar();
  }
}

function iniciar() {
  console.log("====================================");
  console.log("CHOKNEXUS AUTO DEPLOY");
  console.log("====================================");
  console.log("Monitorando alterações...");
  console.log(`Branch: ${BRANCH}`);
  console.log(`Remote: ${REMOTE}`);
  console.log(`Debounce: ${DEBOUNCE_MS / 1000}s`);
  console.log("====================================");

  watch(ROOT, { recursive: true }, (_evt, arquivo) => {
    if (!arquivo || !relevante(String(arquivo))) return;
    if (!timer && !rodando) log("Alteração detectada.");
    agendar();
  });

  // Publica o que já estiver pendente ao iniciar.
  agendar();
}

const lock = createServer();
lock.once("error", () => {
  log("Auto deploy já está em execução.");
  process.exit(0);
});
lock.listen(LOCK_PORT, "127.0.0.1", iniciar);
