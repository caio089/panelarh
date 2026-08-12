# Panela RH

Sistema de recrutamento e seleção da **Panela Velha**.

## Rodar em desenvolvimento (SQLite de teste)

```bash
npm install
npm run dev:all
```

Isso sobe:
- **Web** → http://localhost:5173
- **API SQLite** → http://localhost:8787

Banco local: `server/data/panelarh.db`  
Schema: `server/schema.sql`

### Contas

| Tipo | URL | Credenciais |
|------|-----|-------------|
| Candidato | `/auth` | Crie a conta na tela |
| Admin | `/admin/login` | `admin@panela.local` / `admin123` |

### Fluxo

1. Público: `/` (vagas)
2. Candidato cria conta → preenche perfil → candidata-se
3. Admin vê tudo em `/admin`

## Scripts

- `npm run dev` — só frontend
- `npm run server` — só API SQLite
- `npm run dev:all` — os dois juntos
- `npm run build` — build de produção
