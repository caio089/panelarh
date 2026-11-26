-- Sessão real para o login administrativo já usado pelo painel.
-- O hash corresponde à senha administrativa vigente; a senha não vai para o frontend.
alter table public.staff_access drop constraint if exists staff_access_id_check;
alter table public.staff_access add constraint staff_access_id_check check (id in ('rh', 'admin'));
insert into public.staff_access (id, email, password_hash)
values ('admin', 'admin@panelavelha.com', '$2a$12$yQS3jyl7X69nL/4o9./5xuyN3ld6pFq8zdzLd8BpvJ6jhLis.w9Wa')
on conflict (id) do nothing;

create table private.admin_sessions (
  token_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table private.admin_sessions enable row level security;
revoke all on private.admin_sessions from public, anon, authenticated;

create function private.valid_admin_session(p_token text)
returns boolean language plpgsql security definer set search_path = private, extensions as $$
begin
  if coalesce(length(p_token), 0) <> 64 then return false; end if;
  update private.admin_sessions
  set last_seen_at = now()
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and expires_at > now();
  return found;
end;
$$;
revoke all on function private.valid_admin_session(text) from public, anon, authenticated;

create function public.admin_start_session(p_email text, p_password text)
returns text language plpgsql security definer set search_path = public, private, extensions as $$
declare v_token text;
begin
  if not exists (
    select 1 from public.staff_access
    where id = 'admin' and lower(email) = lower(btrim(coalesce(p_email, '')))
      and password_hash = extensions.crypt(coalesce(p_password, ''), password_hash)
  ) then raise exception 'E-mail ou senha inválidos.'; end if;
  delete from private.admin_sessions where expires_at <= now();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.admin_sessions(token_hash, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '8 hours');
  return v_token;
end;
$$;
revoke all on function public.admin_start_session(text, text) from public;
grant execute on function public.admin_start_session(text, text) to anon, authenticated;

-- A tabela registra movimentações futuras. Os registros antigos não têm data de mudança de etapa.
create table private.candidate_status_events (
  id bigint generated always as identity primary key,
  candidate_id uuid not null,
  unit_id uuid references public.units(id) on delete set null,
  candidate_created_at timestamptz not null,
  previous_status text not null,
  next_status text not null,
  changed_at timestamptz not null default now()
);
create index candidate_status_events_changed_idx on private.candidate_status_events(changed_at desc);
create index candidate_status_events_unit_changed_idx on private.candidate_status_events(unit_id, changed_at desc);
alter table private.candidate_status_events enable row level security;
revoke all on private.candidate_status_events from public, anon, authenticated;

create function private.record_candidate_status_change()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  insert into private.candidate_status_events(candidate_id, unit_id, candidate_created_at, previous_status, next_status)
  select new.id, v.unit_id, new.criado_em, old.status, new.status
  from public.vagas v where v.id = new.vaga_id;
  return new;
end;
$$;
revoke all on function private.record_candidate_status_change() from public, anon, authenticated;
create trigger record_candidate_status_change
  after update of status on public.candidatos
  for each row when (old.status is distinct from new.status)
  execute function private.record_candidate_status_change();

create function public.admin_dashboard_snapshot(p_token text, p_days integer default 30)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  v_since date;
  v_since_at timestamptz;
begin
  if not private.valid_admin_session(p_token) then raise exception 'Sessão administrativa expirada. Entre novamente.'; end if;
  if p_days not in (7, 30, 90) then raise exception 'Período inválido.'; end if;
  v_since := v_today - p_days + 1;
  v_since_at := v_since::timestamp at time zone 'America/Fortaleza';
  return jsonb_build_object(
    'generated_at', now(), 'period_from', v_since, 'period_to', v_today,
    'candidates', (
      select jsonb_build_object(
        'total', count(*),
        'new', count(*) filter (where (c.criado_em at time zone 'America/Fortaleza')::date >= v_since),
        'pending', count(*) filter (where c.status = 'pendente'),
        'pending_over_7_days', count(*) filter (where c.status = 'pendente' and c.criado_em < now() - interval '7 days'),
        'interviews', count(*) filter (where c.status = 'entrevista'),
        'approved', count(*) filter (where c.status = 'aprovada'),
        'rejected', count(*) filter (where c.status = 'reprovada'),
        'talent_pool', count(*) filter (where c.status = 'banco')
      ) from public.candidatos c
    ),
    'active_vacancies', (select count(*) from public.vagas where ativa is true),
    'activity', jsonb_build_object(
      'status_changes', (select count(*) from private.candidate_status_events where changed_at >= v_since_at),
      'interviews_started', (select count(*) from private.candidate_status_events where next_status = 'entrevista' and changed_at >= v_since_at),
      'decisions', (select count(*) from private.candidate_status_events where next_status in ('aprovada', 'reprovada') and changed_at >= v_since_at),
      'occurrences_recorded', (select count(*) from public.occurrences where created_at >= v_since_at),
      'documents_registered', (select count(*) from public.personnel_documents where created_at >= v_since_at),
      'time_reports_imported', (select count(*) from public.time_reports where imported_at >= v_since_at),
      'last_status_change', (select max(changed_at) from private.candidate_status_events)
    ),
    'occurrences', (
      select jsonb_build_object(
        'absences', count(*) filter (where kind = 'falta'),
        'warnings', count(*) filter (where kind = 'advertencia'),
        'medical_notes', count(*) filter (where kind = 'atestado'),
        'suspensions', count(*) filter (where kind = 'suspensao')
      ) from public.occurrences
      where occurred_on between v_since and v_today
    ),
    'units', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'name', u.name,
        'headcount', (select count(*) from public.collaborators c where c.unit_id = u.id and c.status = 'ativo'),
        'active_vacancies', (select count(*) from public.vagas v where v.unit_id = u.id and v.ativa is true),
        'new_candidates', (select count(*) from public.candidatos c join public.vagas v on v.id = c.vaga_id where v.unit_id = u.id and (c.criado_em at time zone 'America/Fortaleza')::date >= v_since),
        'pending', (select count(*) from public.candidatos c join public.vagas v on v.id = c.vaga_id where v.unit_id = u.id and c.status = 'pendente'),
        'interviews', (select count(*) from public.candidatos c join public.vagas v on v.id = c.vaga_id where v.unit_id = u.id and c.status = 'entrevista'),
        'absences', (select count(*) from public.occurrences o where o.unit_id = u.id and o.kind = 'falta' and o.occurred_on between v_since and v_today),
        'warnings', (select count(*) from public.occurrences o where o.unit_id = u.id and o.kind = 'advertencia' and o.occurred_on between v_since and v_today),
        'avg_hiring_days', (select round(avg((e.changed_at at time zone 'America/Fortaleza')::date - (e.candidate_created_at at time zone 'America/Fortaleza')::date), 1) from private.candidate_status_events e where e.unit_id = u.id and e.next_status = 'aprovada' and e.changed_at >= v_since_at)
      ) order by u.name), '[]'::jsonb) from public.units u
    ),
    'weekly_candidates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week_start', g.week_start::date,
        'count', (select count(*) from public.candidatos c where (c.criado_em at time zone 'America/Fortaleza') >= g.week_start and (c.criado_em at time zone 'America/Fortaleza') < g.week_start + interval '7 days')
      ) order by g.week_start), '[]'::jsonb)
      from generate_series(date_trunc('week', v_since::timestamp), date_trunc('week', v_today::timestamp), interval '7 days') as g(week_start)
    )
  );
end;
$$;
revoke all on function public.admin_dashboard_snapshot(text, integer) from public;
grant execute on function public.admin_dashboard_snapshot(text, integer) to anon, authenticated;
