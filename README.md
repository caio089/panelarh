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

## Histórico mensal das TVs

A migração `competition_fill_lease` cria uma reserva de 75 segundos por unidade para os lotes de até 60 segundos da Saipos. Ao ativar um ambiente Vercel que usa a Saipos de produção, configure a variável sensível de servidor `COMPETITION_WORKER_KEY` com o valor de `worker_key` gerado em `competition_worker.fill_leases`. A função usa também `VITE_SUPABASE_URL` e a chave pública do mesmo projeto. Se a reserva estiver ocupada ou indisponível, a TV continua exibindo os dados já obtidos e tenta completar o histórico no próximo ciclo.

## Documentos privados do colaborador

O portal individual e os PDFs do RH usam o bucket privado `rh-documentos`. Além das variáveis públicas do Supabase, configure somente no servidor/Vercel uma chave secreta do projeto em `SUPABASE_SECRET_KEY` (recomendado) ou `SUPABASE_SERVICE_ROLE_KEY`. Nunca use essa chave com o prefixo `VITE_`.

Os links compartilhados em `/colaborador/:token` são pessoais e revogáveis. As URLs diretas dos PDFs expiram em 15 minutos, mas o colaborador pode voltar ao link pessoal para gerar um novo acesso ao arquivo.
