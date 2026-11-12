-- Candidaturas do site público. O painel (admin e RH) lê a mesma tabela.
-- Admin e RH não entram pelo Supabase Auth; usam a chave pública, no mesmo modelo das vagas.

create table if not exists public.candidatos (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references public.vagas (id) on delete cascade,
  nome text not null,
  info_complementar text,
  experiencia text,
  referencia text,
  status text not null default 'pendente',
  data_inicio_treinamento date,
  curriculo_url text,
  curriculo_nome text,
  criado_em timestamptz not null default now(),
  constraint candidatos_nome_len check (char_length(btrim(nome)) between 2 and 160),
  constraint candidatos_status_check check (
    status in ('pendente', 'entrevista', 'aprovada', 'reprovada', 'banco')
  )
);

create index if not exists candidatos_vaga_id_idx on public.candidatos (vaga_id);
create index if not exists candidatos_criado_em_idx on public.candidatos (criado_em desc);

alter table public.candidatos enable row level security;

drop policy if exists candidatos_read on public.candidatos;
drop policy if exists candidatos_insert on public.candidatos;
drop policy if exists candidatos_update on public.candidatos;
drop policy if exists candidatos_delete on public.candidatos;

create policy candidatos_read on public.candidatos
  for select to anon, authenticated
  using (true);

create policy candidatos_insert on public.candidatos
  for insert to anon, authenticated
  with check (
    status = 'pendente'
    and exists (
      select 1 from public.vagas vaga
      where vaga.id = vaga_id and vaga.ativa is true
    )
  );

create policy candidatos_update on public.candidatos
  for update to anon, authenticated
  using (true)
  with check (true);

create policy candidatos_delete on public.candidatos
  for delete to anon, authenticated
  using (true);

grant select, insert, update, delete on public.candidatos to anon, authenticated;
revoke truncate, trigger, references on table public.candidatos from anon, authenticated;
