-- Central de RH e Departamento Pessoal.
-- Dados clínicos (CID, laudos e diagnósticos) não são armazenados neste schema.
-- Documentos serão guardados em bucket privado e manipulados somente por rotas
-- servidoras autorizadas, nunca diretamente pelo navegador.

create table if not exists public.hr_training_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'geral',
  description text,
  duration_minutes integer,
  validity_months smallint,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_training_programs_title_chk check (char_length(btrim(title)) between 2 and 120),
  constraint hr_training_programs_category_chk check (char_length(btrim(category)) between 2 and 60),
  constraint hr_training_programs_duration_chk check (duration_minutes is null or duration_minutes between 1 and 2880),
  constraint hr_training_programs_validity_chk check (validity_months is null or validity_months between 1 and 120)
);

create table if not exists public.hr_training_assignments (
  id uuid primary key default gen_random_uuid(),
  training_program_id uuid not null references public.hr_training_programs (id) on delete cascade,
  collaborator_id uuid not null references public.collaborators (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete restrict,
  status text not null default 'pendente',
  scheduled_on date,
  completed_on date,
  expires_on date,
  certificate_path text,
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_training_assignments_status_chk check (status in ('pendente', 'agendado', 'concluido', 'dispensado')),
  constraint hr_training_assignments_notes_chk check (char_length(notes) <= 1000),
  constraint hr_training_assignments_dates_chk check (completed_on is null or scheduled_on is null or completed_on >= scheduled_on),
  unique (training_program_id, collaborator_id)
);

create index if not exists hr_training_assignments_unit_status_idx
  on public.hr_training_assignments (unit_id, status, scheduled_on);
create index if not exists hr_training_assignments_collaborator_idx
  on public.hr_training_assignments (collaborator_id, completed_on desc);

create table if not exists public.personnel_documents (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete restrict,
  kind text not null,
  status text not null default 'pendente',
  competence date,
  issued_on date,
  expires_on date,
  storage_path text,
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personnel_documents_kind_chk check (kind in ('holerite', 'exame_admissional', 'exame_periodico', 'aso', 'contrato', 'ferias', 'outro')),
  constraint personnel_documents_status_chk check (status in ('pendente', 'disponivel', 'vencido', 'arquivado')),
  constraint personnel_documents_path_chk check (storage_path is null or (storage_path !~ '^/' and char_length(storage_path) <= 500)),
  constraint personnel_documents_notes_chk check (char_length(notes) <= 1000)
);

create index if not exists personnel_documents_collaborator_idx
  on public.personnel_documents (collaborator_id, kind, competence desc);
create index if not exists personnel_documents_expiry_idx
  on public.personnel_documents (unit_id, expires_on)
  where expires_on is not null and status <> 'arquivado';

create table if not exists public.medical_leave_records (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete restrict,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'em_analise',
  has_medical_document boolean not null default false,
  return_confirmed_on date,
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medical_leave_records_status_chk check (status in ('em_analise', 'aprovado', 'encerrado', 'cancelado')),
  constraint medical_leave_records_dates_chk check (ends_on >= starts_on),
  constraint medical_leave_records_notes_chk check (char_length(notes) <= 500)
);

comment on table public.medical_leave_records is
  'Afastamento operacional. Não armazena CID, diagnóstico, laudo ou arquivo clínico.';
comment on column public.medical_leave_records.notes is
  'Nota operacional curta. É proibido inserir CID, diagnóstico ou dados de saúde.';

create index if not exists medical_leave_records_unit_status_idx
  on public.medical_leave_records (unit_id, status, starts_on desc);
create index if not exists medical_leave_records_collaborator_idx
  on public.medical_leave_records (collaborator_id, starts_on desc);

create table if not exists public.sid_records (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete restrict,
  reference_code text not null,
  category text not null default 'funcional',
  status text not null default 'aberto',
  occurred_on date not null,
  closed_on date,
  notes text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sid_records_reference_chk check (char_length(btrim(reference_code)) between 2 and 80),
  constraint sid_records_category_chk check (category in ('funcional', 'disciplinar', 'administrativo', 'outro')),
  constraint sid_records_status_chk check (status in ('aberto', 'em_acompanhamento', 'encerrado', 'cancelado')),
  constraint sid_records_dates_chk check (closed_on is null or closed_on >= occurred_on),
  constraint sid_records_notes_chk check (char_length(notes) <= 1000)
);

create index if not exists sid_records_unit_status_idx
  on public.sid_records (unit_id, status, occurred_on desc);
create index if not exists sid_records_collaborator_idx
  on public.sid_records (collaborator_id, occurred_on desc);

drop trigger if exists touch_hr_training_programs on public.hr_training_programs;
create trigger touch_hr_training_programs
  before update on public.hr_training_programs
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_hr_training_assignments on public.hr_training_assignments;
create trigger touch_hr_training_assignments
  before update on public.hr_training_assignments
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_personnel_documents on public.personnel_documents;
create trigger touch_personnel_documents
  before update on public.personnel_documents
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_medical_leave_records on public.medical_leave_records;
create trigger touch_medical_leave_records
  before update on public.medical_leave_records
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_sid_records on public.sid_records;
create trigger touch_sid_records
  before update on public.sid_records
  for each row execute function public.touch_updated_at();

drop trigger if exists enforce_hr_training_assignment_unit on public.hr_training_assignments;
create trigger enforce_hr_training_assignment_unit
  before insert or update on public.hr_training_assignments
  for each row execute function public.enforce_collaborator_unit();

drop trigger if exists enforce_personnel_document_unit on public.personnel_documents;
create trigger enforce_personnel_document_unit
  before insert or update on public.personnel_documents
  for each row execute function public.enforce_collaborator_unit();

drop trigger if exists enforce_medical_leave_unit on public.medical_leave_records;
create trigger enforce_medical_leave_unit
  before insert or update on public.medical_leave_records
  for each row execute function public.enforce_collaborator_unit();

drop trigger if exists enforce_sid_record_unit on public.sid_records;
create trigger enforce_sid_record_unit
  before insert or update on public.sid_records
  for each row execute function public.enforce_collaborator_unit();

create table if not exists private.hr_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  occurred_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  constraint hr_audit_log_entity_type_chk check (entity_type in ('treinamento', 'documento', 'afastamento', 'sid')),
  constraint hr_audit_log_action_chk check (action in ('criado', 'atualizado', 'arquivado', 'consultado'))
);

create index if not exists hr_audit_log_entity_idx
  on private.hr_audit_log (entity_type, entity_id, occurred_at desc);

alter table public.hr_training_programs enable row level security;
alter table public.hr_training_assignments enable row level security;
alter table public.personnel_documents enable row level security;
alter table public.medical_leave_records enable row level security;
alter table public.sid_records enable row level security;
alter table private.hr_audit_log enable row level security;

-- O frontend não recebe acesso anônimo. Administração autenticada e APIs com
-- service_role são as únicas vias previstas para o módulo.
revoke all on table public.hr_training_programs from anon, authenticated;
revoke all on table public.hr_training_assignments from anon, authenticated;
revoke all on table public.personnel_documents from anon, authenticated;
revoke all on table public.medical_leave_records from anon, authenticated;
revoke all on table public.sid_records from anon, authenticated;
revoke all on table private.hr_audit_log from public, anon, authenticated;

grant select, insert, update, delete on public.hr_training_programs to authenticated;
grant select, insert, update, delete on public.hr_training_assignments to authenticated;
grant select, insert, update, delete on public.personnel_documents to authenticated;
grant select, insert, update, delete on public.medical_leave_records to authenticated;
grant select, insert, update, delete on public.sid_records to authenticated;

create policy hr_training_programs_admin_only on public.hr_training_programs
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy hr_training_assignments_admin_only on public.hr_training_assignments
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy personnel_documents_admin_only on public.personnel_documents
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy medical_leave_records_admin_only on public.medical_leave_records
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy sid_records_admin_only on public.sid_records
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rh-documentos',
  'rh-documentos',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Não há policy em storage.objects: uploads e downloads deste bucket são feitos
-- somente por API com service_role após autorização do RH.
