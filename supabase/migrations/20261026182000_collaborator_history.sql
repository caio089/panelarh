-- Histórico único do colaborador. Candidatos não participam deste modelo.
create table if not exists public.collaborator_history_events (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete restrict,
  event_type text not null,
  event_date date not null,
  title text not null,
  summary text not null default '',
  source_kind text not null,
  source_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collaborator_history_events_type_chk check (event_type in ('admissao', 'atestado', 'advertencia', 'falta', 'suspensao', 'sid', 'documento', 'treinamento', 'anotacao')),
  constraint collaborator_history_events_title_chk check (char_length(btrim(title)) between 2 and 140),
  constraint collaborator_history_events_summary_chk check (char_length(summary) <= 1000),
  constraint collaborator_history_events_source_chk check (source_kind in ('ocorrencia', 'afastamento', 'sid', 'documento', 'treinamento', 'manual')),
  unique (source_kind, source_id)
);

create index if not exists collaborator_history_events_collaborator_idx
  on public.collaborator_history_events (collaborator_id, event_date desc, created_at desc);
create index if not exists collaborator_history_events_unit_type_idx
  on public.collaborator_history_events (unit_id, event_type, event_date desc);

create table if not exists public.collaborator_attachments (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete restrict,
  history_event_id uuid references public.collaborator_history_events (id) on delete set null,
  category text not null,
  file_name text not null,
  content_type text not null,
  storage_path text not null unique,
  uploaded_at timestamptz not null default now(),
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  constraint collaborator_attachments_category_chk check (category in ('atestado', 'advertencia', 'sid', 'documento', 'treinamento', 'outro')),
  constraint collaborator_attachments_file_name_chk check (char_length(btrim(file_name)) between 1 and 180),
  constraint collaborator_attachments_content_type_chk check (content_type in ('application/pdf', 'image/jpeg', 'image/png')),
  constraint collaborator_attachments_path_chk check (storage_path !~ '^/' and char_length(storage_path) <= 500)
);

create index if not exists collaborator_attachments_collaborator_idx
  on public.collaborator_attachments (collaborator_id, uploaded_at desc)
  where archived_at is null;
create index if not exists collaborator_attachments_history_idx
  on public.collaborator_attachments (history_event_id)
  where history_event_id is not null;
create index if not exists collaborator_attachments_created_by_idx
  on public.collaborator_attachments (created_by)
  where created_by is not null;

-- Apenas metadados entram no histórico. Nunca CID, diagnóstico ou laudo.
create or replace function private.sync_collaborator_history(
  p_collaborator_id uuid,
  p_unit_id uuid,
  p_event_type text,
  p_event_date date,
  p_title text,
  p_summary text,
  p_source_kind text,
  p_source_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.collaborator_history_events (
    collaborator_id, unit_id, event_type, event_date, title, summary, source_kind, source_id
  ) values (
    p_collaborator_id, p_unit_id, p_event_type, p_event_date, p_title, left(coalesce(p_summary, ''), 1000), p_source_kind, p_source_id
  )
  on conflict (source_kind, source_id) do update
  set event_type = excluded.event_type,
      event_date = excluded.event_date,
      title = excluded.title,
      summary = excluded.summary,
      updated_at = now();
end;
$$;

create or replace function private.sync_occurrence_history()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_title text;
begin
  v_title := case new.kind
    when 'advertencia' then 'Advertência registrada'
    when 'falta' then 'Falta registrada'
    when 'atestado' then 'Atestado registrado'
    when 'suspensao' then 'Suspensão registrada'
    else 'Ocorrência registrada'
  end;
  perform private.sync_collaborator_history(new.collaborator_id, new.unit_id, new.kind, new.occurred_on, v_title, new.note, 'ocorrencia', new.id);
  return new;
end;
$$;

create or replace function private.sync_leave_history()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.sync_collaborator_history(
    new.collaborator_id, new.unit_id, 'atestado', new.starts_on, 'Afastamento registrado',
    case when new.has_medical_document then 'Documento apresentado.' else 'Documento pendente.' end,
    'afastamento', new.id
  );
  return new;
end;
$$;

create or replace function private.sync_sid_history()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.sync_collaborator_history(new.collaborator_id, new.unit_id, 'sid', new.occurred_on, 'SID ' || new.reference_code, new.notes, 'sid', new.id);
  return new;
end;
$$;

create or replace function private.sync_document_history()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform private.sync_collaborator_history(new.collaborator_id, new.unit_id, 'documento', coalesce(new.issued_on, new.competence, current_date), 'Documento: ' || replace(new.kind, '_', ' '), new.notes, 'documento', new.id);
  return new;
end;
$$;

create or replace function private.sync_training_history()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_title text;
begin
  select 'Treinamento: ' || title into v_title from public.hr_training_programs where id = new.training_program_id;
  perform private.sync_collaborator_history(new.collaborator_id, new.unit_id, 'treinamento', coalesce(new.completed_on, new.scheduled_on, current_date), coalesce(v_title, 'Treinamento registrado'), new.notes, 'treinamento', new.id);
  return new;
end;
$$;

drop trigger if exists sync_occurrence_history on public.occurrences;
create trigger sync_occurrence_history after insert or update on public.occurrences
  for each row execute function private.sync_occurrence_history();
drop trigger if exists sync_leave_history on public.medical_leave_records;
create trigger sync_leave_history after insert or update on public.medical_leave_records
  for each row execute function private.sync_leave_history();
drop trigger if exists sync_sid_history on public.sid_records;
create trigger sync_sid_history after insert or update on public.sid_records
  for each row execute function private.sync_sid_history();
drop trigger if exists sync_document_history on public.personnel_documents;
create trigger sync_document_history after insert or update on public.personnel_documents
  for each row execute function private.sync_document_history();
drop trigger if exists sync_training_history on public.hr_training_assignments;
create trigger sync_training_history after insert or update on public.hr_training_assignments
  for each row execute function private.sync_training_history();

drop trigger if exists touch_collaborator_history_events on public.collaborator_history_events;
create trigger touch_collaborator_history_events before update on public.collaborator_history_events
  for each row execute function public.touch_updated_at();

drop trigger if exists enforce_collaborator_history_unit on public.collaborator_history_events;
create trigger enforce_collaborator_history_unit before insert or update on public.collaborator_history_events
  for each row execute function public.enforce_collaborator_unit();
drop trigger if exists enforce_collaborator_attachment_unit on public.collaborator_attachments;
create trigger enforce_collaborator_attachment_unit before insert or update on public.collaborator_attachments
  for each row execute function public.enforce_collaborator_unit();

alter table public.collaborator_history_events enable row level security;
alter table public.collaborator_attachments enable row level security;
revoke all on table public.collaborator_history_events from anon, authenticated;
revoke all on table public.collaborator_attachments from anon, authenticated;
grant select, insert, update, delete on public.collaborator_history_events to authenticated;
grant select, insert, update, delete on public.collaborator_attachments to authenticated;

create policy collaborator_history_events_admin_only on public.collaborator_history_events
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy collaborator_attachments_admin_only on public.collaborator_attachments
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on function private.sync_collaborator_history(uuid, uuid, text, date, text, text, text, uuid) from public, anon, authenticated;
revoke all on function private.sync_occurrence_history() from public, anon, authenticated;
revoke all on function private.sync_leave_history() from public, anon, authenticated;
revoke all on function private.sync_sid_history() from public, anon, authenticated;
revoke all on function private.sync_document_history() from public, anon, authenticated;
revoke all on function private.sync_training_history() from public, anon, authenticated;
