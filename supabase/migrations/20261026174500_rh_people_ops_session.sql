-- Sessão curta e opaca para a conta de RH já existente.
-- Não cria outro usuário nem expõe as tabelas de DP ao cliente anônimo.
create table if not exists private.rh_sessions (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table private.rh_sessions enable row level security;
revoke all on table private.rh_sessions from public, anon, authenticated;

create or replace function private.valid_rh_session(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_hash text;
begin
  if coalesce(length(p_token), 0) <> 64 then return false; end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  update private.rh_sessions
     set last_seen_at = now()
   where token_hash = v_hash and expires_at > now();
  return found;
end;
$$;

create or replace function public.rh_start_session(p_email text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_token text;
begin
  if not exists (
    select 1 from public.staff_access
    where id = 'rh'
      and lower(email) = lower(btrim(coalesce(p_email, '')))
      and password_hash = extensions.crypt(coalesce(p_password, ''), password_hash)
  ) then
    raise exception 'E-mail ou senha inválidos.';
  end if;
  delete from private.rh_sessions where expires_at <= now();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.rh_sessions (token_hash, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '8 hours');
  return v_token;
end;
$$;

create or replace function public.rh_people_ops_overview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;
  return jsonb_build_object(
    'treinamentos_pendentes', (select count(*) from public.hr_training_assignments where status in ('pendente', 'agendado')),
    'documentos_pendentes', (select count(*) from public.personnel_documents where status = 'pendente'),
    'atestados_abertos', (select count(*) from public.medical_leave_records where status in ('em_analise', 'aprovado')),
    'sid_abertos', (select count(*) from public.sid_records where status in ('aberto', 'em_acompanhamento'))
  );
end;
$$;

revoke all on function private.valid_rh_session(text) from public, anon, authenticated;
revoke all on function public.rh_start_session(text, text) from public;
revoke all on function public.rh_people_ops_overview(text) from public;
grant execute on function public.rh_start_session(text, text) to anon, authenticated;
grant execute on function public.rh_people_ops_overview(text) to anon, authenticated;
