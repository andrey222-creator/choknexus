# ChokNexus

Economia máxima de tokens. Zero narração de progresso — responda apenas com resultado final ou bloqueio real.

## Dados
Arius/Oracle (schema PROREG) é a única fonte de verdade. Nunca inventar tabelas, colunas, valores ou relacionamentos. Não explorar o banco sem necessidade real da tarefa.

## Arquitetura
Frontend (browser) → `server/` (Node/Express local, `server/db.js` + `server/index.js`) → Oracle (oracledb) → Arius.
Nunca conexão direta do browser ao Oracle. Reutilizar essa infra existente; não criar uma segunda.

## Segurança
Credenciais Oracle só em `server/.env` (nunca commitado, está no `.gitignore`). Nunca colocar usuário, senha, connection string ou DSN no frontend.

## Autenticação
`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` em `server/index.js` (lógica em `server/auth.js`, sessão em `server/session.js`).
Valida contra `PROREG.BAS_T_USUARIOS` (ID_USUARIO, ATIVO='T', BLOQUEADO='T', MODO_AUTENTICACAO, SENHA). MODO_AUTENTICACAO suportado: 0 e 2 (interno); 1 (externo/LDAP) não implementado — config global `AUTENTICACAO_LDAP` está 'F', então modo 0 resolve para interno. SENHA (32 chars) comparada como MD5 hex — assumido a partir do tamanho da coluna, não confirmado com teste real; validar com login real antes de considerar definitivo. Sessão é opaca em memória (Map), cookie HttpOnly `choknexus_sid`, sem senha em nenhum lugar do frontend/logs.

## Estilo de mudança
Alterações mínimas e cirúrgicas. Preservar `index.html`, `src/css/login.css` e estrutura/layout existentes.
