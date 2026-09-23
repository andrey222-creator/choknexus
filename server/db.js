import oracledb from "oracledb";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  return v;
}

export const CONFIG = {
  user: requireEnv("ARIUS_DB_USER"),
  password: requireEnv("ARIUS_DB_PASSWORD"),
  connectString: requireEnv("ARIUS_DB_CONNECT_STRING"),
  schema: (process.env.ARIUS_DB_SCHEMA || "PROREG").toUpperCase(),
};

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];

export async function withConnection(fn) {
  const conn = await oracledb.getConnection({
    user: CONFIG.user,
    password: CONFIG.password,
    connectString: CONFIG.connectString,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}
