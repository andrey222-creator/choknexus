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

// Retorna { ok: true, resumo } ou { ok: false, status, motivo } (motivo somente para log interno).
export async function obterResumoComercial() {
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

  return {
    ok: true,
    resumo: {
      builtAt: dados.builtAt,
      painelVendas: dados.painelVendas,
      painelFluxoCupons: dados.painelFluxoCupons,
    },
  };
}
