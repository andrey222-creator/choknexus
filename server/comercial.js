import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Fallback: estrutura local atual (projetos Vendas e chokNexus lado a lado em MCP/).
const CAMINHO_PADRAO = path.resolve(
  __dirname,
  "..",
  "..",
  "Vendas",
  "private-output",
  "choknexus-metas-atingimentos.json"
);

const CAMINHO_JSON = process.env.CHOKNEXUS_COMERCIAL_DATA_FILE
  ? path.resolve(process.env.CHOKNEXUS_COMERCIAL_DATA_FILE)
  : CAMINHO_PADRAO;

function estruturaValida(dados) {
  return (
    dados &&
    typeof dados === "object" &&
    dados.painelVendas &&
    Array.isArray(dados.painelVendas.headers) &&
    Array.isArray(dados.painelVendas.rows) &&
    dados.painelFluxoCupons &&
    Array.isArray(dados.painelFluxoCupons.headers) &&
    Array.isArray(dados.painelFluxoCupons.rows)
  );
}

// O arquivo é grande (inclui relatorioCompleto) e só muda a cada ciclo do
// Vendas: reaproveita o parse enquanto o mtime não mudar.
let cache = { mtimeMs: 0, dados: null };

async function lerDados() {
  let stat;
  try {
    stat = await fs.stat(CAMINHO_JSON);
  } catch (err) {
    return { ok: false, status: 503, motivo: `arquivo_indisponivel:${err.code || err.message}` };
  }
  if (cache.dados && cache.mtimeMs === stat.mtimeMs) return { ok: true, dados: cache.dados };

  let conteudo;
  try {
    conteudo = await fs.readFile(CAMINHO_JSON, "utf8");
  } catch (err) {
    return { ok: false, status: 503, motivo: `arquivo_indisponivel:${err.code || err.message}` };
  }

  let dados;
  try {
    dados = JSON.parse(conteudo);
  } catch (err) {
    return { ok: false, status: 502, motivo: "json_invalido" };
  }

  if (!estruturaValida(dados)) {
    return { ok: false, status: 502, motivo: "estrutura_invalida" };
  }

  cache = { mtimeMs: stat.mtimeMs, dados };
  return { ok: true, dados };
}

// Retorna { ok: true, resumo } ou { ok: false, status, motivo } (motivo somente para log interno).
export async function obterResumoComercial() {
  const lido = await lerDados();
  if (!lido.ok) return lido;
  const dados = lido.dados;

  return {
    ok: true,
    resumo: {
      builtAt: dados.builtAt,
      painelVendas: dados.painelVendas,
      painelFluxoCupons: dados.painelFluxoCupons,
      quadrosComercial: Array.isArray(dados.quadrosComercial) ? dados.quadrosComercial : null,
    },
  };
}

const ID_CAMPANHA = /^[A-Za-z0-9_-]{1,64}$/;
const MES = /^\d{4}-\d{2}$/;
const DATA_URI = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/=\s]+)$/;

// Logo de uma campanha do quadro "fornecedores": só é servido se o
// campanhaId estiver referenciado em quadrosComercial; a imagem vem do data
// URI da própria campanha no JSON privado. Retorna { ok, mime, buffer }.
export async function obterLogoCampanha(campanhaId) {
  if (!ID_CAMPANHA.test(String(campanhaId || ""))) return { ok: false, status: 404 };

  const lido = await lerDados();
  if (!lido.ok) return lido;
  const dados = lido.dados;

  const fornecedores = (dados.quadrosComercial || []).find((q) => q && q.id === "fornecedores");
  let mes = null;
  for (const row of (fornecedores && fornecedores.rows) || []) {
    for (const cell of row.cells || []) {
      if (cell && cell.logo && cell.logo.campanhaId === campanhaId) mes = cell.logo.mes;
    }
  }
  if (!mes || !MES.test(mes)) return { ok: false, status: 404 };

  const campanhas = dados.relatorioCompleto?.state?.campanhasPorMes?.[mes];
  const campanha = Array.isArray(campanhas) ? campanhas.find((c) => c && c.id === campanhaId) : null;
  const m = campanha && typeof campanha.logo === "string" ? DATA_URI.exec(campanha.logo) : null;
  if (!m) return { ok: false, status: 404 };

  return { ok: true, mime: m[1], buffer: Buffer.from(m[2], "base64") };
}
