-- RH pode corrigir ou apagar um item do histórico sem recriar a ficha.
drop function if exists public.rh_list_collaborator_history(text, uuid);

create or replace function public.rh_list_collaborator_history(p_token text, p_collaborator_id uuid)
returns table (
  id uuid,
  event_type text,
  event_date date,
  title text,
  summary text,
  source_kind text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;

  if not exists (
    select 1 from public.collaborators as c where c.id = p_collaborator_id
  ) then
    raise exception 'Colaborador não encontrado.';
  end if;

  return query
  select h.id, h.event_type, h.event_date, h.title, h.summary, h.source_kind, h.created_at
  from public.collaborator_history_events as h
  where h.collaborator_id = p_collaborator_id
  order by h.event_date desc, h.created_at desc;
end;
$$;

create or replace function private.delete_history_source(p_kind text, p_source_id uuid, p_collaborator_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_kind = 'ocorrencia' then
    delete from public.occurrences where id = p_source_id and collaborator_id = p_collaborator_id;
  elsif p_kind = 'documento' then
    delete from public.personnel_documents where id = p_source_id and collaborator_id = p_collaborator_id;
  elsif p_kind = 'sid' then
    delete from public.sid_records where id = p_source_id and collaborator_id = p_collaborator_id;
  elsif p_kind = 'afastamento' then
    delete from public.medical_leave_records where id = p_source_id and collaborator_id = p_collaborator_id;
  elsif p_kind = 'treinamento' then
    delete from public.hr_training_assignments where id = p_source_id and collaborator_id = p_collaborator_id;
  end if;
end;
$$;

create or replace function public.rh_update_collaborator_history(
  p_token text,
  p_event_id uuid,
  p_event_date date,
  p_summary text default ''
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_event public.collaborator_history_events%rowtype;
  v_note text;
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;
  if p_event_date is null then
    raise exception 'Informe a data do registro.';
  end if;

  select * into v_event from public.collaborator_history_events where id = p_event_id;
  if not found then
    raise exception 'Registro do histórico não encontrado.';
  end if;

  v_note := left(btrim(coalesce(p_summary, '')), 1000);
  if v_event.source_kind = 'ocorrencia' and char_length(v_note) > 500 then
    raise exception 'A observação desta ocorrência pode ter no máximo 500 caracteres.';
  end if;

  if v_event.source_kind = 'ocorrencia' then
    update public.occurrences
    set occurred_on = p_event_date, note = left(v_note, 500)
    where id = v_event.source_id and collaborator_id = v_event.collaborator_id;
  elsif v_event.source_kind = 'documento' then
    update public.personnel_documents
    set competence = p_event_date, notes = v_note
    where id = v_event.source_id and collaborator_id = v_event.collaborator_id;
  elsif v_event.source_kind = 'sid' then
    update public.sid_records
    set occurred_on = p_event_date, notes = v_note
    where id = v_event.source_id and collaborator_id = v_event.collaborator_id;
  elsif v_event.source_kind = 'afastamento' then
    update public.medical_leave_records
    set starts_on = p_event_date,
        ends_on = greatest(ends_on, p_event_date),
        notes = left(v_note, 500)
    where id = v_event.source_id and collaborator_id = v_event.collaborator_id;
  elsif v_event.source_kind = 'treinamento' then
    update public.hr_training_assignments
    set completed_on = case when completed_on is not null then p_event_date else completed_on end,
        scheduled_on = case when scheduled_on is not null then p_event_date else coalesce(scheduled_on, p_event_date) end,
        notes = v_note
    where id = v_event.source_id and collaborator_id = v_event.collaborator_id;
  end if;

  update public.collaborator_history_events
  set event_date = p_event_date, summary = v_note, updated_at = now()
  where id = p_event_id;
end;
$$;

create or replace function public.rh_delete_collaborator_history(p_token text, p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_event public.collaborator_history_events%rowtype;
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;

  select * into v_event from public.collaborator_history_events where id = p_event_id;
  if not found then
    raise exception 'Registro do histórico não encontrado.';
  end if;

  -- Nunca apaga o colaborador. Admissão usa o id da pessoa como origem.
  perform private.delete_history_source(v_event.source_kind, v_event.source_id, v_event.collaborator_id);
  delete from public.collaborator_history_events where id = p_event_id;
end;
$$;

create or replace function public.rh_clear_collaborator_history(p_token text, p_collaborator_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_event record;
  v_removed integer := 0;
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;
  if not exists (select 1 from public.collaborators where id = p_collaborator_id) then
    raise exception 'Colaborador não encontrado.';
  end if;

  for v_event in
    select id, source_kind, source_id
    from public.collaborator_history_events
    where collaborator_id = p_collaborator_id
      and event_type <> 'admissao'
  loop
    perform private.delete_history_source(v_event.source_kind, v_event.source_id, p_collaborator_id);
    delete from public.collaborator_history_events where id = v_event.id;
    v_removed := v_removed + 1;
  end loop;

  return v_removed;
end;
$$;

revoke all on function public.rh_list_collaborator_history(text, uuid) from public;
revoke all on function public.rh_update_collaborator_history(text, uuid, date, text) from public;
revoke all on function public.rh_delete_collaborator_history(text, uuid) from public;
revoke all on function public.rh_clear_collaborator_history(text, uuid) from public;
revoke all on function private.delete_history_source(text, uuid, uuid) from public, anon, authenticated;

grant execute on function public.rh_list_collaborator_history(text, uuid) to anon, authenticated;
grant execute on function public.rh_update_collaborator_history(text, uuid, date, text) to anon, authenticated;
grant execute on function public.rh_delete_collaborator_history(text, uuid) to anon, authenticated;
grant execute on function public.rh_clear_collaborator_history(text, uuid) to anon, authenticated;
