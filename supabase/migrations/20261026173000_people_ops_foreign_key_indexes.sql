-- Índices para as chaves de auditoria dos módulos RH/DP.
create index if not exists hr_training_assignments_created_by_idx
  on public.hr_training_assignments (created_by)
  where created_by is not null;

create index if not exists personnel_documents_created_by_idx
  on public.personnel_documents (created_by)
  where created_by is not null;

create index if not exists medical_leave_records_created_by_idx
  on public.medical_leave_records (created_by)
  where created_by is not null;

create index if not exists sid_records_created_by_idx
  on public.sid_records (created_by)
  where created_by is not null;

create index if not exists hr_audit_log_actor_idx
  on private.hr_audit_log (actor_id)
  where actor_id is not null;
