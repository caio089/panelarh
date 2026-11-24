-- Arquivos privados, portal individual do colaborador e comprovante de leitura.
alter table public.personnel_documents
  add column if not exists file_name text,
  add column if not exists content_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists requires_acknowledgement boolean not null default true,
  add column if not exists published_at timestamptz,
  add column if not exists source_history_event_id uuid
    references public.collaborator_history_events (id) on delete set null;

alter table public.personnel_documents
  drop constraint if exists personnel_documents_kind_chk;
alter table public.personnel_documents
  add constraint personnel_documents_kind_chk check (
    kind in (
      'holerite', 'exame_admissional', 'exame_periodico', 'aso', 'contrato',
      'ferias', 'falta', 'atestado', 'advertencia', 'suspensao', 'comunicado', 'outro'
    )
  ),
  add constraint personnel_documents_file_name_chk check (
    file_name is null or char_length(btrim(file_name)) between 1 and 180
  ),
  add constraint personnel_documents_content_type_chk check (
    content_type is null or content_type = 'application/pdf'
  ),
  add constraint personnel_documents_file_size_chk check (
    file_size_bytes is null or file_size_bytes between 1 and 10485760
  ),
  add constraint personnel_documents_file_metadata_chk check (
    (storage_path is null and file_name is null and content_type is null and file_size_bytes is null)
    or
    (storage_path is not null and file_name is not null and content_type is not null and file_size_bytes is not null)
  );

create index if not exists personnel_documents_history_event_idx
  on public.personnel_documents (source_history_event_id)
  where source_history_event_id is not null;

create table if not exists private.collaborator_portal_links (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators (id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  revoked_at timestamptz,
  constraint collaborator_portal_links_status_chk check (status in ('active', 'revoked')),
  constraint collaborator_portal_links_token_hash_chk check (char_length(token_hash) = 64)
);

create unique index if not exists collaborator_portal_links_one_active_idx
  on private.collaborator_portal_links (collaborator_id)
  where status = 'active';

create table if not exists private.collaborator_document_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators (id) on delete cascade,
  document_id uuid not null unique references public.personnel_documents (id) on delete cascade,
  portal_link_id uuid not null references private.collaborator_portal_links (id) on delete restrict,
  signer_name text not null,
  acknowledged_at timestamptz not null default now(),
  user_agent text not null default '',
  constraint collaborator_document_ack_signer_chk check (char_length(btrim(signer_name)) between 2 and 120),
  constraint collaborator_document_ack_agent_chk check (char_length(user_agent) <= 500)
);

create index if not exists collaborator_document_ack_collaborator_idx
  on private.collaborator_document_acknowledgements (collaborator_id, acknowledged_at desc);
create index if not exists collaborator_document_ack_portal_link_idx
  on private.collaborator_document_acknowledgements (portal_link_id);

alter table private.collaborator_portal_links enable row level security;
alter table private.collaborator_document_acknowledgements enable row level security;
revoke all on table private.collaborator_portal_links from public, anon, authenticated;
revoke all on table private.collaborator_document_acknowledgements from public, anon, authenticated;

-- Documento ligado a uma ocorrência aparece somente uma vez no histórico.
create or replace function private.sync_document_history()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.source_history_event_id is not null then
    return new;
  end if;
  perform private.sync_collaborator_history(
    new.collaborator_id,
    new.unit_id,
    'documento',
    coalesce(new.issued_on, new.competence, current_date),
    'Documento: ' || replace(new.kind, '_', ' '),
    new.notes,
    'documento',
    new.id
  );
  return new;
end;
$$;

create or replace function public.rh_prepare_document_upload(
  p_token text,
  p_collaborator_id uuid,
  p_kind text,
  p_competence date,
  p_notes text,
  p_file_name text,
  p_content_type text,
  p_file_size_bytes bigint,
  p_requires_acknowledgement boolean default true,
  p_source_kind text default null,
  p_source_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_document_id uuid := gen_random_uuid();
  v_unit_id uuid;
  v_history_event_id uuid;
  v_safe_name text;
  v_storage_path text;
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;
  select unit_id into v_unit_id from public.collaborators where id = p_collaborator_id;
  if v_unit_id is null then raise exception 'Colaborador não encontrado.'; end if;
  if p_kind not in (
    'holerite', 'exame_admissional', 'exame_periodico', 'aso', 'contrato',
    'ferias', 'falta', 'atestado', 'advertencia', 'suspensao', 'comunicado', 'outro'
  ) then raise exception 'Tipo de documento inválido.'; end if;
  if p_content_type <> 'application/pdf' or p_file_size_bytes not between 1 and 10485760 then
    raise exception 'Envie um PDF de até 10 MB.';
  end if;
  if char_length(btrim(coalesce(p_file_name, ''))) not between 1 and 180 then
    raise exception 'Nome do arquivo inválido.';
  end if;
  if char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'A observação pode ter no máximo 1000 caracteres.';
  end if;

  if p_source_kind is not null or p_source_id is not null then
    if p_source_kind <> 'ocorrencia' or p_source_id is null then
      raise exception 'Origem do anexo inválida.';
    end if;
    select h.id into v_history_event_id
    from public.collaborator_history_events h
    where h.collaborator_id = p_collaborator_id
      and h.source_kind = p_source_kind
      and h.source_id = p_source_id;
    if v_history_event_id is null then raise exception 'Registro de origem não encontrado.'; end if;
  end if;

  v_safe_name := lower(regexp_replace(btrim(p_file_name), '[^a-zA-Z0-9._-]+', '-', 'g'));
  v_safe_name := regexp_replace(v_safe_name, '^-+|-+$', '', 'g');
  if v_safe_name = '' then v_safe_name := 'documento.pdf'; end if;
  if right(v_safe_name, 4) <> '.pdf' then v_safe_name := v_safe_name || '.pdf'; end if;
  v_storage_path := p_collaborator_id::text || '/' || v_document_id::text || '/' || left(v_safe_name, 160);

  insert into public.personnel_documents (
    id, collaborator_id, unit_id, kind, status, competence, storage_path, notes,
    file_name, content_type, file_size_bytes, requires_acknowledgement, source_history_event_id
  ) values (
    v_document_id, p_collaborator_id, v_unit_id, p_kind, 'pendente', p_competence,
    v_storage_path, left(btrim(coalesce(p_notes, '')), 1000), btrim(p_file_name),
    p_content_type, p_file_size_bytes, coalesce(p_requires_acknowledgement, true), v_history_event_id
  );

  return jsonb_build_object('document_id', v_document_id, 'storage_path', v_storage_path);
end;
$$;

create or replace function public.rh_complete_document_upload(p_token text, p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;
  update public.personnel_documents
  set status = 'disponivel', published_at = coalesce(published_at, now())
  where id = p_document_id and storage_path is not null;
  if not found then raise exception 'Documento não encontrado.'; end if;
end;
$$;

create or replace function public.rh_delete_pending_document(p_token text, p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;
  delete from public.personnel_documents where id = p_document_id and status = 'pendente';
end;
$$;

create or replace function public.rh_document_portal_admin(p_token text, p_collaborator_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_result jsonb;
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;
  if not exists (select 1 from public.collaborators where id = p_collaborator_id) then
    raise exception 'Colaborador não encontrado.';
  end if;

  select jsonb_build_object(
    'portal', coalesce((
      select jsonb_build_object(
        'active', true,
        'created_at', l.created_at,
        'last_accessed_at', l.last_accessed_at
      )
      from private.collaborator_portal_links l
      where l.collaborator_id = p_collaborator_id and l.status = 'active'
    ), jsonb_build_object('active', false)),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'kind', d.kind,
        'status', d.status,
        'competence', d.competence,
        'notes', d.notes,
        'file_name', d.file_name,
        'content_type', d.content_type,
        'file_size_bytes', d.file_size_bytes,
        'storage_path', d.storage_path,
        'requires_acknowledgement', d.requires_acknowledgement,
        'published_at', d.published_at,
        'acknowledged_at', a.acknowledged_at,
        'signer_name', a.signer_name
      ) order by coalesce(d.published_at, d.created_at) desc)
      from public.personnel_documents d
      left join private.collaborator_document_acknowledgements a on a.document_id = d.id
      where d.collaborator_id = p_collaborator_id and d.storage_path is not null
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.rh_create_collaborator_portal_link(p_token text, p_collaborator_id uuid)
returns text
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_raw_token text;
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;
  if not exists (select 1 from public.collaborators where id = p_collaborator_id) then
    raise exception 'Colaborador não encontrado.';
  end if;
  update private.collaborator_portal_links
  set status = 'revoked', revoked_at = now()
  where collaborator_id = p_collaborator_id and status = 'active';
  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.collaborator_portal_links (collaborator_id, token_hash)
  values (p_collaborator_id, encode(extensions.digest(v_raw_token, 'sha256'), 'hex'));
  return v_raw_token;
end;
$$;

create or replace function public.rh_revoke_collaborator_portal_link(p_token text, p_collaborator_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;
  update private.collaborator_portal_links
  set status = 'revoked', revoked_at = now()
  where collaborator_id = p_collaborator_id and status = 'active';
end;
$$;

create or replace function public.collaborator_portal_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_link private.collaborator_portal_links%rowtype;
  v_result jsonb;
begin
  if coalesce(char_length(p_token), 0) <> 64 then raise exception 'Link inválido ou expirado.'; end if;
  select * into v_link
  from private.collaborator_portal_links
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and status = 'active';
  if not found then raise exception 'Link inválido ou expirado.'; end if;
  update private.collaborator_portal_links set last_accessed_at = now() where id = v_link.id;

  select jsonb_build_object(
    'collaborator', jsonb_build_object('full_name', c.full_name, 'job_title', c.job_title, 'unit_name', u.name),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'kind', d.kind,
        'competence', d.competence,
        'notes', d.notes,
        'file_name', d.file_name,
        'file_size_bytes', d.file_size_bytes,
        'storage_path', d.storage_path,
        'requires_acknowledgement', d.requires_acknowledgement,
        'published_at', d.published_at,
        'acknowledged_at', a.acknowledged_at,
        'signer_name', a.signer_name
      ) order by coalesce(d.published_at, d.created_at) desc)
      from public.personnel_documents d
      left join private.collaborator_document_acknowledgements a on a.document_id = d.id
      where d.collaborator_id = c.id and d.status = 'disponivel' and d.storage_path is not null
    ), '[]'::jsonb)
  ) into v_result
  from public.collaborators c
  join public.units u on u.id = c.unit_id
  where c.id = v_link.collaborator_id;
  return v_result;
end;
$$;

create or replace function public.collaborator_acknowledge_document(
  p_token text,
  p_document_id uuid,
  p_signer_name text,
  p_user_agent text default ''
)
returns timestamptz
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_link private.collaborator_portal_links%rowtype;
  v_acknowledged_at timestamptz;
begin
  if coalesce(char_length(p_token), 0) <> 64 then raise exception 'Link inválido ou expirado.'; end if;
  if char_length(btrim(coalesce(p_signer_name, ''))) not between 2 and 120 then
    raise exception 'Digite seu nome completo para confirmar.';
  end if;
  select * into v_link
  from private.collaborator_portal_links
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and status = 'active';
  if not found then raise exception 'Link inválido ou expirado.'; end if;
  if not exists (
    select 1 from public.personnel_documents d
    where d.id = p_document_id
      and d.collaborator_id = v_link.collaborator_id
      and d.status = 'disponivel'
      and d.requires_acknowledgement
  ) then raise exception 'Documento não encontrado ou sem confirmação pendente.'; end if;

  insert into private.collaborator_document_acknowledgements (
    collaborator_id, document_id, portal_link_id, signer_name, user_agent
  ) values (
    v_link.collaborator_id, p_document_id, v_link.id, btrim(p_signer_name), left(coalesce(p_user_agent, ''), 500)
  )
  on conflict (document_id) do update
  set signer_name = excluded.signer_name,
      portal_link_id = excluded.portal_link_id,
      user_agent = excluded.user_agent,
      acknowledged_at = now()
  returning acknowledged_at into v_acknowledged_at;
  return v_acknowledged_at;
end;
$$;

revoke all on function public.rh_prepare_document_upload(text, uuid, text, date, text, text, text, bigint, boolean, text, uuid) from public;
revoke all on function public.rh_complete_document_upload(text, uuid) from public;
revoke all on function public.rh_delete_pending_document(text, uuid) from public;
revoke all on function public.rh_document_portal_admin(text, uuid) from public;
revoke all on function public.rh_create_collaborator_portal_link(text, uuid) from public;
revoke all on function public.rh_revoke_collaborator_portal_link(text, uuid) from public;
revoke all on function public.collaborator_portal_snapshot(text) from public;
revoke all on function public.collaborator_acknowledge_document(text, uuid, text, text) from public;

grant execute on function public.rh_prepare_document_upload(text, uuid, text, date, text, text, text, bigint, boolean, text, uuid) to anon, authenticated;
grant execute on function public.rh_complete_document_upload(text, uuid) to anon, authenticated;
grant execute on function public.rh_delete_pending_document(text, uuid) to anon, authenticated;
grant execute on function public.rh_document_portal_admin(text, uuid) to anon, authenticated;
grant execute on function public.rh_create_collaborator_portal_link(text, uuid) to anon, authenticated;
grant execute on function public.rh_revoke_collaborator_portal_link(text, uuid) to anon, authenticated;
grant execute on function public.collaborator_portal_snapshot(text) to anon, authenticated;
grant execute on function public.collaborator_acknowledge_document(text, uuid, text, text) to anon, authenticated;

revoke all on function private.sync_document_history() from public, anon, authenticated;
