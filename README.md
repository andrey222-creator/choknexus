# ChokNexus

Sistema interno ChokNexus.

## Estrutura

- Frontend HTML/CSS/JS (`index.html`, `home.html`, `src/`)
- Backend Node.js (`server/`)
- Integração Oracle/Arius (via `oracledb`, somente no backend)
- Autenticação baseada nos usuários do Arius

## Ambiente

Requisitos: Node.js >= 18 e Oracle Instant Client compatível com `oracledb`.

```bash
cd server
npm install
cp .env.example .env   # preencher as variáveis
npm start
```

Credenciais existem apenas em `server/.env`, que nunca deve ser versionado.
