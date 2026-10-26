-- Operação de colaboradores pela sessão opaca e curta da conta de RH.
-- Cada operação é limitada, valida a sessão e nunca retorna CID, laudo ou arquivo clínico.
create or replace function public.rh_list_units(p_token text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;

  return query select u.id, u.name from public.units u order by u.name;
end;
$$;

create or replace function public.rh_list_collaborators(p_token text)
returns table (
  id uuid, unit_id uuid, unit_name text, full_name text, job_title text,
  operational_phone text, status text, hired_on date, created_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;

  return query
  select c.id, c.unit_id, u.name, c.full_name, c.job_title, c.operational_phone, c.status, c.hired_on, c.created_at
  from public.collaborators c
  join public.units u on u.id = c.unit_id
  order by c.status = 'ativo' desc, c.full_name;
end;
$$;

create or replace function public.rh_create_collaborator(
  p_token text,
  p_unit_id uuid,
  p_full_name text,
  p_job_title text,
  p_operational_phone text default null,
  p_hired_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_id uuid;
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;
  if p_unit_id is null or not exists (select 1 from public.units where id = p_unit_id) then
    raise exception 'Selecione uma unidade válida.';
  end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 120 then
    raise exception 'Informe o nome completo do colaborador.';
  end if;
  if char_length(btrim(coalesce(p_job_title, ''))) not between 2 and 80 then
    raise exception 'Informe o cargo do colaborador.';
  end if;

  insert into public.collaborators (unit_id, full_name, job_title, operational_phone, hired_on)
  values (p_unit_id, btrim(p_full_name), btrim(p_job_title), nullif(btrim(p_operational_phone), ''), p_hired_on)
  returning id into v_id;

  insert into public.collaborator_history_events (
    collaborator_id, unit_id, event_type, event_date, title, summary, source_kind, source_id
  ) values (
    v_id, p_unit_id, 'admissao', coalesce(p_hired_on, current_date), 'Colaborador cadastrado',
    'Cadastro operacional criado pela equipe de RH.', 'manual', v_id
  );
  return v_id;
end;
$$;

create or replace function public.rh_list_collaborator_history(p_token text, p_collaborator_id uuid)
returns table (id uuid, event_type text, event_date date, title text, summary text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;
  if not exists (select 1 from public.collaborators where id = p_collaborator_id) then
    raise exception 'Colaborador não encontrado.';
  end if;
  return query
  select h.id, h.event_type, h.event_date, h.title, h.summary, h.created_at
  from public.collaborator_history_events h
  where h.collaborator_id = p_collaborator_id
  order by h.event_date desc, h.created_at desc;
end;
$$;

create or replace function public.rh_register_occurrence(
  p_token text, p_collaborator_id uuid, p_kind text, p_occurred_on date,
  p_note text default '', p_days integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare v_id uuid; v_unit_id uuid;
begin
  if not private.valid_rh_session(p_token) then raise exception 'Sessão do RH expirada. Entre novamente.'; end if;
  select unit_id into v_unit_id from public.collaborators where id = p_collaborator_id;
  if v_unit_id is null then raise exception 'Colaborador não encontrado.'; end if;
  if p_kind not in ('falta', 'advertencia', 'atestado', 'suspensao') then raise exception 'Tipo de ocorrência inválido.'; end if;
  if p_occurred_on is null or p_days not between 1 and 60 or char_length(coalesce(p_note, '')) > 500 then raise exception 'Revise a data, duração e observação.'; end if;
  insert into public.occurrences (collaborator_id, unit_id, kind, occurred_on, note, days)
  values (p_collaborator_id, v_unit_id, p_kind, p_occurred_on, left(btrim(coalesce(p_note, '')), 500), p_days)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.rh_register_sid(
  p_token text, p_collaborator_id uuid, p_reference_code text, p_category text,
  p_occurred_on date, p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare v_id uuid; v_unit_id uuid;
begin
  if not private.valid_rh_session(p_token) then raise exception 'Sessão do RH expirada. Entre novamente.'; end if;
  select unit_id into v_unit_id from public.collaborators where id = p_collaborator_id;
  if v_unit_id is null then raise exception 'Colaborador não encontrado.'; end if;
  if char_length(btrim(coalesce(p_reference_code, ''))) not between 2 and 80 or p_category not in ('funcional', 'disciplinar', 'administrativo', 'outro') or p_occurred_on is null or char_length(coalesce(p_notes, '')) > 1000 then raise exception 'Revise os dados do SID.'; end if;
  insert into public.sid_records (collaborator_id, unit_id, reference_code, category, occurred_on, notes)
  values (p_collaborator_id, v_unit_id, btrim(p_reference_code), p_category, p_occurred_on, left(btrim(coalesce(p_notes, '')), 1000))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.rh_register_document(
  p_token text, p_collaborator_id uuid, p_kind text, p_competence date,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare v_id uuid; v_unit_id uuid;
begin
  if not private.valid_rh_session(p_token) then raise exception 'Sessão do RH expirada. Entre novamente.'; end if;
  select unit_id into v_unit_id from public.collaborators where id = p_collaborator_id;
  if v_unit_id is null then raise exception 'Colaborador não encontrado.'; end if;
  if p_kind not in ('holerite', 'exame_admissional', 'exame_periodico', 'aso', 'contrato', 'ferias', 'outro') or char_length(coalesce(p_notes, '')) > 1000 then raise exception 'Revise os dados do documento.'; end if;
  insert into public.personnel_documents (collaborator_id, unit_id, kind, competence, notes)
  values (p_collaborator_id, v_unit_id, p_kind, p_competence, left(btrim(coalesce(p_notes, '')), 1000))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.rh_list_units(text) from public;
revoke all on function public.rh_list_collaborators(text) from public;
revoke all on function public.rh_create_collaborator(text, uuid, text, text, text, date) from public;
revoke all on function public.rh_list_collaborator_history(text, uuid) from public;
revoke all on function public.rh_register_occurrence(text, uuid, text, date, text, integer) from public;
revoke all on function public.rh_register_sid(text, uuid, text, text, date, text) from public;
revoke all on function public.rh_register_document(text, uuid, text, date, text) from public;

grant execute on function public.rh_list_units(text) to anon, authenticated;
grant execute on function public.rh_list_collaborators(text) to anon, authenticated;
grant execute on function public.rh_create_collaborator(text, uuid, text, text, text, date) to anon, authenticated;
grant execute on function public.rh_list_collaborator_history(text, uuid) to anon, authenticated;
grant execute on function public.rh_register_occurrence(text, uuid, text, date, text, integer) to anon, authenticated;
grant execute on function public.rh_register_sid(text, uuid, text, text, date, text) to anon, authenticated;
grant execute on function public.rh_register_document(text, uuid, text, date, text) to anon, authenticated;
