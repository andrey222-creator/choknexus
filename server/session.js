import crypto from "node:crypto";
import { serialize, parse } from "cookie";

export const SESSION_COOKIE = "choknexus_sid";
// Cookie adicional, restrito às rotas somente-leitura /api/comercial, para o
// frontend do GitHub Pages consultar este backend local (requisição cross-site:
// exige SameSite=None; Secure — aceito pelo Chrome em http://localhost).
export const PAGES_COOKIE = "choknexus_pages";
const PAGES_COOKIE_PATH = "/api/comercial";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

const sessions = new Map();

function limparExpiradas() {
  const agora = Date.now();
  for (const [id, sessao] of sessions) {
    if (sessao.expiraEm <= agora) sessions.delete(id);
  }
}

export function criarSessao(usuario) {
  limparExpiradas();
  const id = crypto.randomBytes(32).toString("hex");
  sessions.set(id, { ...usuario, expiraEm: Date.now() + SESSION_TTL_MS });
  return id;
}

export function obterSessao(id) {
  if (!id) return null;
  const sessao = sessions.get(id);
  if (!sessao) return null;
  if (sessao.expiraEm <= Date.now()) {
    sessions.delete(id);
    return null;
  }
  return sessao;
}

export function destruirSessao(id) {
  if (id) sessions.delete(id);
}

export function lerCookieSessao(req) {
  const cookies = parse(req.headers.cookie || "");
  return cookies[SESSION_COOKIE];
}

export function lerCookiePages(req) {
  const cookies = parse(req.headers.cookie || "");
  return cookies[PAGES_COOKIE];
}

function serializarCookiePages(valor, maxAge) {
  return serialize(PAGES_COOKIE, valor, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: PAGES_COOKIE_PATH,
    maxAge,
  });
}

export function setCookiePages(res, id) {
  res.append("Set-Cookie", serializarCookiePages(id, SESSION_TTL_MS / 1000));
}

export function limparCookiePages(res) {
  res.append("Set-Cookie", serializarCookiePages("", 0));
}

export function setCookieSessao(res, id, seguro) {
  res.append(
    "Set-Cookie",
    serialize(SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: !!seguro,
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    })
  );
}

export function limparCookieSessao(res, seguro) {
  res.append(
    "Set-Cookie",
    serialize(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: !!seguro,
      path: "/",
      maxAge: 0,
    })
  );
}
