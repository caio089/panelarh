-- Resumo dos sócios por intervalo fechado de datas locais (Fortaleza).
-- Toda leitura de pessoas continua protegida pelo token administrativo.
create function public.admin_dashboard_snapshot_range(p_token text, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  v_from_at timestamptz;
  v_to_exclusive_at timestamptz;
begin
  if not private.valid_admin_session(p_token) then
    raise exception 'Sessão administrativa expirada. Entre novamente.';
  end if;
  if p_from is null or p_to is null or p_from > p_to or p_to > v_today or p_to - p_from > 365 then
    raise exception 'Escolha um intervalo válido de até 366 dias, sem datas futuras.';
  end if;
  v_from_at := p_from::timestamp at time zone 'America/Fortaleza';
  v_to_exclusive_at := (p_to + 1)::timestamp at time zone 'America/Fortaleza';

  return jsonb_build_object(
    'generated_at', now(), 'period_from', p_from, 'period_to', p_to,
    'candidates', (
      select jsonb_build_object(
        'total', count(*),
        'new', count(*) filter (where c.criado_em >= v_from_at and c.criado_em < v_to_exclusive_at),
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
      'status_changes', (select count(*) from private.candidate_status_events where changed_at >= v_from_at and changed_at < v_to_exclusive_at),
      'interviews_started', (select count(*) from private.candidate_status_events where next_status = 'entrevista' and changed_at >= v_from_at and changed_at < v_to_exclusive_at),
      'decisions', (select count(*) from private.candidate_status_events where next_status in ('aprovada', 'reprovada') and changed_at >= v_from_at and changed_at < v_to_exclusive_at),
      'occurrences_recorded', (select count(*) from public.occurrences where created_at >= v_from_at and created_at < v_to_exclusive_at),
      'documents_registered', (select count(*) from public.personnel_documents where created_at >= v_from_at and created_at < v_to_exclusive_at),
      'time_reports_imported', (select count(*) from public.time_reports where imported_at >= v_from_at and imported_at < v_to_exclusive_at)
    ),
    'occurrences', (
      select jsonb_build_object(
        'absences', count(*) filter (where kind = 'falta'),
        'warnings', count(*) filter (where kind = 'advertencia'),
        'medical_notes', count(*) filter (where kind = 'atestado'),
        'suspensions', count(*) filter (where kind = 'suspensao')
      ) from public.occurrences where occurred_on between p_from and p_to
    ),
    'recent_occurrences', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', recent.id, 'kind', recent.kind, 'occurred_on', recent.occurred_on,
        'collaborator_name', recent.collaborator_name, 'unit_name', recent.unit_name)
        order by recent.occurred_on desc, recent.id), '[]'::jsonb)
      from (
        select o.id, o.kind, o.occurred_on, c.full_name as collaborator_name, u.name as unit_name
        from public.occurrences o
        join public.collaborators c on c.id = o.collaborator_id
        join public.units u on u.id = o.unit_id
        where o.occurred_on between p_from and p_to and o.kind in ('falta', 'advertencia', 'suspensao')
        order by o.occurred_on desc, o.created_at desc
        limit 8
      ) recent
    ),
    'units', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'name', u.name,
        'headcount', (select count(*) from public.collaborators c where c.unit_id = u.id and c.status = 'ativo'),
        'active_vacancies', (select count(*) from public.vagas v where v.unit_id = u.id and v.ativa is true),
        'new_candidates', (select count(*) from public.candidatos c join public.vagas v on v.id = c.vaga_id where v.unit_id = u.id and c.criado_em >= v_from_at and c.criado_em < v_to_exclusive_at),
        'pending', (select count(*) from public.candidatos c join public.vagas v on v.id = c.vaga_id where v.unit_id = u.id and c.status = 'pendente'),
        'interviews', (select count(*) from public.candidatos c join public.vagas v on v.id = c.vaga_id where v.unit_id = u.id and c.status = 'entrevista'),
        'absences', (select count(*) from public.occurrences o where o.unit_id = u.id and o.kind = 'falta' and o.occurred_on between p_from and p_to),
        'warnings', (select count(*) from public.occurrences o where o.unit_id = u.id and o.kind = 'advertencia' and o.occurred_on between p_from and p_to)
      ) order by u.name), '[]'::jsonb) from public.units u
    ),
    'weekly_candidates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week_start', g.week_start::date,
        'count', (select count(*) from public.candidatos c where c.criado_em >= greatest(g.week_start at time zone 'America/Fortaleza', v_from_at)
          and c.criado_em < least((g.week_start + interval '7 days') at time zone 'America/Fortaleza', v_to_exclusive_at))
      ) order by g.week_start), '[]'::jsonb)
      from generate_series(date_trunc('week', p_from::timestamp), date_trunc('week', p_to::timestamp), interval '7 days') as g(week_start)
    )
  );
end;
$$;
revoke all on function public.admin_dashboard_snapshot_range(text, date, date) from public;
grant execute on function public.admin_dashboard_snapshot_range(text, date, date) to anon, authenticated;
