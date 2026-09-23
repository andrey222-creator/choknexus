import crypto from "node:crypto";
import { withConnection } from "./db.js";

// MODO_AUTENTICACAO suportado nesta implementacao:
// 0 = Default (config global AUTENTICACAO_LDAP = F -> resolve para interno)
// 2 = Interno - ERP
// 1 (Externo - Servidor de Diretorios) nao e suportado ainda.
const MODOS_SUPORTADOS = new Set([0, 2]);

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_TENTATIVAS = 5;
const tentativas = new Map();

// O login digitado (ex.: "andrey.oliveira") nao existe como valor literal
// em nenhuma tabela do Arius (BAS_T_USUARIOS, usuarios legado, email) -
// confirmado por busca exaustiva. O unico jeito de "andrey.oliveira"
// resolver para ID_USUARIO=ANDREYOLIVEIRA e removendo separadores e
// maiusculizando antes do SELECT, entao essa e a normalizacao aplicada.
function normalizarUsuario(usuario) {
  return String(usuario || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function md5Hex(texto) {
  return crypto.createHash("md5").update(texto, "utf8").digest("hex");
}

function hashConfere(hashArmazenado, senha, idUsuario) {
  if (!hashArmazenado) return false;
  const alvo = hashArmazenado.trim().toUpperCase();
  return md5Hex(senha).toUpperCase() === alvo;
}

export function checkRateLimit(chave) {
  const agora = Date.now();
  const registro = tentativas.get(chave);
  if (!registro || agora - registro.inicio > RATE_LIMIT_WINDOW_MS) {
    return { limitado: false };
  }
  return { limitado: registro.count >= RATE_LIMIT_MAX_TENTATIVAS };
}

export function registrarTentativa(chave, sucesso) {
  if (sucesso) {
    tentativas.delete(chave);
    return;
  }
  const agora = Date.now();
  const registro = tentativas.get(chave);
  if (!registro || agora - registro.inicio > RATE_LIMIT_WINDOW_MS) {
    tentativas.set(chave, { count: 1, inicio: agora });
  } else {
    registro.count += 1;
  }
}

// Retorna { ok: true, usuario: { idUsuario, nome } } ou { ok: false, motivo }
// `motivo` e somente para log interno, nunca deve ir para o cliente.
export async function autenticar(usuarioRaw, senha) {
  const idUsuario = normalizarUsuario(usuarioRaw);
  if (!idUsuario || !senha) {
    return { ok: false, motivo: "entrada_invalida" };
  }

  const row = await withConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT id_usuario, nome, ativo, bloqueado, modo_autenticacao, senha
       FROM PROREG.BAS_T_USUARIOS WHERE id_usuario = :id`,
      { id: idUsuario }
    );
    return result.rows[0] || null;
  });

  if (!row) {
    return { ok: false, motivo: "usuario_nao_encontrado" };
  }
  if (row.ATIVO !== "T") {
    return { ok: false, motivo: "usuario_inativo" };
  }
  if (row.BLOQUEADO === "T") {
    return { ok: false, motivo: "usuario_bloqueado" };
  }
  if (!MODOS_SUPORTADOS.has(row.MODO_AUTENTICACAO)) {
    return { ok: false, motivo: "modo_autenticacao_nao_suportado" };
  }
  if (!hashConfere(row.SENHA, senha, idUsuario)) {
    return { ok: false, motivo: "senha_invalida" };
  }

  return { ok: true, usuario: { idUsuario: row.ID_USUARIO, nome: row.NOME } };
}
