-- Controle de acesso do painel (admin, gerente, colaborador) com RLS.
-- LGPD: minimização. Não coletamos saúde, biometria, religião ou opinião política.
-- CPF, salário, endereço residencial e dados bancários ficam em personal_data,
-- visível só para admin. O cliente não escolhe o próprio papel.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role, authenticated;

-- Allowlist fora da API. Só postgres/service_role insere.
-- Não há e-mails inventados: Matheus e Andresa precisam ser incluídos de verdade.
create table if not exists private.admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint admin_allowlist_email_chk check (
    email = lower(email)
    and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

comment on table private.admin_allowlist is
  'E-mails autorizados a virar admin. Não é exposta ao client. Inserir os e-mails reais de Matheus e Andresa pelo SQL Editor (role postgres). Escolher Admin no cadastro não insere nesta tabela.';

revoke all on table private.admin_allowlist from public, anon, authenticated;

alter table private.admin_allowlist enable row level security;
alter table private.admin_allowlist force row level security;

-- Unidades do restaurante. Endereço aqui é da casa, não da residência do colaborador.
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  opening_hours text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.units add column if not exists address text;
alter table public.units add column if not exists opening_hours text;
alter table public.units add column if not exists created_at timestamptz not null default now();
alter table public.units add column if not exists updated_at timestamptz not null default now();

comment on column public.units.address is
  'Endereço do estabelecimento. Dado operacional da unidade, visível à equipe. Não é endereço residencial.';
comment on column public.units.opening_hours is
  'Horário de funcionamento da casa, visível a quem trabalha na unidade.';

-- Identidade. id = auth.uid(). Papel começa pending e só muda por função privilegiada.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'pending',
  unit_id uuid references public.units (id) on delete set null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists unit_id uuid references public.units (id) on delete set null;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles alter column role set default 'pending';

update public.profiles set role = 'pending' where role is null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_role_check;
  end if;

  alter table public.profiles add constraint profiles_role_check
    check (role in ('pending', 'candidate', 'admin', 'lider', 'gerente', 'colaborador'));
end $$;

comment on column public.profiles.role is
  'Papel de acesso. O client não pode gravar este campo. Admin só via allowlist; gerente e colaborador só via código.';
comment on column public.profiles.phone is
  'Telefone informado pela própria pessoa. Colegas não leem esta tabela. O telefone operacional da escala fica em collaborators.';
comment on column public.profiles.unit_id is
  'Unidade vinculada pelo código de convite. Admin fica sem unidade (enxerga todas).';

create table if not exists public.collaborators (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name text not null,
  job_title text not null,
  operational_phone text,
  status text not null default 'ativo',
  hired_on date,
  expected_entry time,
  shift_preference text,
  preferred_day_off smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'collaborators_status_chk') then
    alter table public.collaborators add constraint collaborators_status_chk
      check (status in ('ativo', 'inativo'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collaborators_shift_chk') then
    alter table public.collaborators add constraint collaborators_shift_chk
      check (shift_preference is null or shift_preference in ('manha', 'tarde', 'flexivel'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collaborators_day_off_chk') then
    alter table public.collaborators add constraint collaborators_day_off_chk
      check (preferred_day_off is null or preferred_day_off between 0 and 6);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collaborators_name_chk') then
    alter table public.collaborators add constraint collaborators_name_chk
      check (char_length(btrim(full_name)) between 2 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collaborators_job_chk') then
    alter table public.collaborators add constraint collaborators_job_chk
      check (char_length(btrim(job_title)) between 2 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'collaborators_phone_chk') then
    alter table public.collaborators add constraint collaborators_phone_chk
      check (operational_phone is null or operational_phone ~ '^[0-9+() .\\-]{8,20}$');
  end if;
end $$;

comment on column public.collaborators.operational_phone is
  'Telefone operacional da escala. Gerente da unidade pode ver. Não usar para dado bancário ou documento.';
comment on table public.collaborators is
  'Ficha operacional da equipe. Sem CPF, salário, endereço residencial ou dados bancários.';

-- Dado pessoal de RH. Só admin lê e grava. Não colocar diagnóstico, CID ou biometria.
create table if not exists public.personal_data (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete cascade,
  collaborator_id uuid unique references public.collaborators (id) on delete cascade,
  cpf text,
  salary_cents integer,
  residential_address text,
  bank_details text,
  birth_date date,
  salary_expectation text,
  updated_at timestamptz not null default now(),
  constraint personal_data_owner_chk check (profile_id is not null or collaborator_id is not null)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'personal_data_cpf_chk') then
    alter table public.personal_data add constraint personal_data_cpf_chk
      check (cpf is null or cpf ~ '^[0-9]{11}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'personal_data_salary_chk') then
    alter table public.personal_data add constraint personal_data_salary_chk
      check (salary_cents is null or salary_cents >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'personal_data_address_chk') then
    alter table public.personal_data add constraint personal_data_address_chk
      check (residential_address is null or char_length(residential_address) <= 240);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'personal_data_bank_chk') then
    alter table public.personal_data add constraint personal_data_bank_chk
      check (bank_details is null or char_length(bank_details) <= 240);
  end if;
end $$;

comment on table public.personal_data is
  'LGPD: dado pessoal de RH, finalidade trabalhista. Visível e editável só por admin. Gerente e colaborador não leem, nem o próprio titular neste painel.';
comment on column public.personal_data.cpf is
  'CPF só com dígitos. Finalidade de identificação trabalhista. Não expor a colegas nem ao gerente.';
comment on column public.personal_data.salary_cents is
  'Salário em centavos. Finalidade de folha. Só admin.';
comment on column public.personal_data.residential_address is
  'Endereço residencial. Distinto do endereço da unidade. Só admin.';
comment on column public.personal_data.bank_details is
  'Dado bancário minimizado. Evitar guardar o que não for necessário à folha. Só admin.';

-- Se o schema antigo guardava CPF/salário no perfil, move e remove da tabela operacional.
do $$
declare
  has_cpf boolean;
  has_birth boolean;
  has_salary boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'cpf'
  ) into has_cpf;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'birth_date'
  ) into has_birth;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'salary_expectation'
  ) into has_salary;

  if has_cpf or has_birth or has_salary then
    execute format(
      'insert into public.personal_data (profile_id, cpf, birth_date, salary_expectation)
       select id, %s, %s, %s
       from public.profiles
       where %s
       on conflict (profile_id) do update set
         cpf = coalesce(public.personal_data.cpf, excluded.cpf),
         birth_date = coalesce(public.personal_data.birth_date, excluded.birth_date),
         salary_expectation = coalesce(public.personal_data.salary_expectation, excluded.salary_expectation)',
      case when has_cpf then 'case when cpf ~ ''^[0-9]{11}$'' then cpf else null end' else 'null::text' end,
      case when has_birth then 'birth_date' else 'null::date' end,
      case when has_salary then 'salary_expectation' else 'null::text' end,
      case
        when has_cpf and has_birth and has_salary then '(cpf is not null or birth_date is not null or salary_expectation is not null)'
        when has_cpf and has_birth then '(cpf is not null or birth_date is not null)'
        when has_cpf and has_salary then '(cpf is not null or salary_expectation is not null)'
        when has_birth and has_salary then '(birth_date is not null or salary_expectation is not null)'
        when has_cpf then 'cpf is not null'
        when has_birth then 'birth_date is not null'
        else 'salary_expectation is not null'
      end
    );
  end if;

  if has_cpf then
    alter table public.profiles drop column cpf;
  end if;
  if has_birth then
    alter table public.profiles drop column birth_date;
  end if;
  if has_salary then
    alter table public.profiles drop column salary_expectation;
  end if;
end $$;

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  week_start date not null,
  published boolean not null default false,
  origin text not null default 'manual',
  updated_at timestamptz not null default now(),
  unique (unit_id, week_start)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'schedules_origin_chk') then
    alter table public.schedules add constraint schedules_origin_chk
      check (origin in ('manual', 'ia'));
  end if;
end $$;

create table if not exists public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  collaborator_id uuid not null references public.collaborators (id) on delete cascade,
  day_index smallint not null,
  shift text not null,
  display_name text not null,
  job_title text not null,
  unique (schedule_id, collaborator_id, day_index)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'schedule_slots_day_chk') then
    alter table public.schedule_slots add constraint schedule_slots_day_chk
      check (day_index between 0 and 6);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'schedule_slots_shift_chk') then
    alter table public.schedule_slots add constraint schedule_slots_shift_chk
      check (shift in ('manha', 'tarde', 'folga'));
  end if;
end $$;

comment on column public.schedule_slots.display_name is
  'Nome publicado na escala da casa. A equipe vê nome e função. Telefone, CPF e salário não entram aqui.';

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  work_date date not null,
  expected_entry time,
  delta_minutes integer not null,
  unique (collaborator_id, work_date)
);

create table if not exists public.occurrences (
  id uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  kind text not null,
  occurred_on date not null,
  note text not null default '',
  days integer not null default 1,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'occurrences_kind_chk') then
    alter table public.occurrences add constraint occurrences_kind_chk
      check (kind in ('falta', 'advertencia', 'atestado', 'suspensao'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'occurrences_days_chk') then
    alter table public.occurrences add constraint occurrences_days_chk
      check (days between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'occurrences_note_chk') then
    alter table public.occurrences add constraint occurrences_note_chk
      check (char_length(note) <= 500);
  end if;
end $$;

comment on column public.occurrences.note is
  'Motivo operacional curto. Proibido gravar CID, diagnóstico, religião, biometria ou qualquer dado de saúde.';
comment on column public.occurrences.kind is
  'Categoria operacional de ausência. Atestado não autoriza armazenar laudo ou condição de saúde.';

create table if not exists public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  unit_id uuid not null references public.units (id) on delete cascade,
  target_role text not null,
  max_uses integer not null default 1,
  uses integer not null default 0,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint invite_codes_uses_chk check (uses >= 0 and uses <= max_uses)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invite_codes_role_chk') then
    alter table public.invite_codes add constraint invite_codes_role_chk
      check (target_role in ('gerente', 'colaborador'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invite_codes_max_chk') then
    alter table public.invite_codes add constraint invite_codes_max_chk
      check (max_uses between 1 and 50);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invite_codes_code_chk') then
    alter table public.invite_codes add constraint invite_codes_code_chk
      check (code ~ '^[A-Z0-9]{6,12}$');
  end if;
end $$;

comment on table public.invite_codes is
  'Convite amarrado a uma unidade e a um papel. Admin gera gerente ou colaborador; gerente só colaborador da própria unidade.';

create index if not exists profiles_unit_id_idx on public.profiles (unit_id);
create index if not exists collaborators_unit_id_idx on public.collaborators (unit_id);
create index if not exists personal_data_profile_id_idx on public.personal_data (profile_id);
create index if not exists schedules_unit_id_idx on public.schedules (unit_id);
create index if not exists schedule_slots_schedule_id_idx on public.schedule_slots (schedule_id);
create index if not exists schedule_slots_collaborator_id_idx on public.schedule_slots (collaborator_id);
create index if not exists time_entries_unit_date_idx on public.time_entries (unit_id, work_date);
create index if not exists occurrences_unit_id_idx on public.occurrences (unit_id);
create index if not exists occurrences_collaborator_id_idx on public.occurrences (collaborator_id);
create index if not exists invite_codes_unit_id_idx on public.invite_codes (unit_id);
create index if not exists invite_codes_active_idx on public.invite_codes (unit_id, target_role)
  where revoked_at is null;

-- Helpers em schema não exposto. search_path vazio. Sem recursão de RLS.
create or replace function private.caller_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid());
$$;

create or replace function private.caller_unit()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.unit_id
  from public.profiles p
  where p.id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

create or replace function private.is_unit_manager(target_unit uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('gerente', 'lider')
      and p.unit_id = target_unit
  );
$$;

create or replace function private.owns_collaborator(target_collaborator uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.collaborators c
    where c.id = target_collaborator
      and c.profile_id = (select auth.uid())
  );
$$;

revoke all on function private.caller_role() from public, anon, authenticated;
revoke all on function private.caller_unit() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
revoke all on function private.is_unit_manager(uuid) from public, anon, authenticated;
revoke all on function private.owns_collaborator(uuid) from public, anon, authenticated;
grant execute on function private.caller_role() to authenticated;
grant execute on function private.caller_unit() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_unit_manager(uuid) to authenticated;
grant execute on function private.owns_collaborator(uuid) to authenticated;

create or replace function private.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  out text := '';
  i integer;
begin
  for i in 0..7 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return out;
end;
$$;

revoke all on function private.generate_invite_code() from public, anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function public.protect_profile_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role or new.unit_id is distinct from old.unit_id then
    if coalesce(current_setting('panela.allow_role_change', true), '') is distinct from 'on' then
      raise exception 'Papel e unidade não podem ser alterados por aqui. Admin entra pela allowlist; gerente e colaborador entram com código de convite.';
    end if;
  end if;

  new.email := (select u.email from auth.users u where u.id = new.id);
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function public.protect_collaborator_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean := coalesce(current_setting('panela.allow_role_change', true), '') = 'on';
begin
  new.full_name := btrim(new.full_name);
  new.job_title := btrim(new.job_title);
  if new.operational_phone is not null then
    new.operational_phone := btrim(new.operational_phone);
  end if;

  if tg_op = 'INSERT' and new.profile_id is not null and not allowed and not (select private.is_admin()) then
    raise exception 'O vínculo da conta com a unidade só acontece ao usar um código de convite válido.';
  end if;

  if tg_op = 'UPDATE' then
    if (new.unit_id is distinct from old.unit_id or new.profile_id is distinct from old.profile_id)
       and not allowed
       and not (select private.is_admin()) then
      raise exception 'Unidade e vínculo de login não podem ser alterados por aqui.';
    end if;

    if not allowed
       and not (select private.is_admin())
       and not (select private.is_unit_manager(old.unit_id)) then
      if new.full_name is distinct from old.full_name
         or new.job_title is distinct from old.job_title
         or new.status is distinct from old.status
         or new.hired_on is distinct from old.hired_on
         or new.expected_entry is distinct from old.expected_entry
         or new.shift_preference is distinct from old.shift_preference
         or new.preferred_day_off is distinct from old.preferred_day_off then
        raise exception 'Você só pode atualizar o próprio telefone operacional.';
      end if;
    end if;

    new.updated_at := pg_catalog.now();
  end if;

  return new;
end;
$$;

create or replace function public.enforce_collaborator_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_unit uuid;
begin
  select c.unit_id into owner_unit
  from public.collaborators c
  where c.id = new.collaborator_id;

  if owner_unit is null or owner_unit is distinct from new.unit_id then
    raise exception 'O registro precisa ser da mesma unidade do colaborador.';
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := left(
    regexp_replace(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        split_part(coalesce(new.email, 'conta'), '@', 1)
      ),
      '[[:cntrl:]]',
      '',
      'g'
    ),
    120
  );

  if char_length(v_name) < 2 then
    v_name := 'Conta';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, v_name, 'pending')
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Cria perfil pending. Ignora qualquer papel enviado pelo client no cadastro.';

create or replace function public.activate_account(p_level text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_email text;
  v_level text := lower(btrim(coalesce(p_level, '')));
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_profile public.profiles%rowtype;
  v_invite public.invite_codes%rowtype;
  v_name text;
begin
  if uid is null then
    raise exception 'Faça login para vincular o acesso.';
  end if;

  if v_level not in ('admin', 'gerente', 'colaborador') then
    raise exception 'Nível de acesso inválido.';
  end if;

  select * into v_profile
  from public.profiles
  where id = uid
  for update;

  if not found then
    raise exception 'Perfil ainda não foi criado. Entre de novo em alguns instantes.';
  end if;

  if v_profile.role in ('admin', 'gerente', 'colaborador', 'lider') then
    raise exception 'Esta conta já possui um nível de acesso.';
  end if;

  perform set_config('panela.allow_role_change', 'on', true);

  if v_level = 'admin' then
    select lower(u.email) into v_email from auth.users u where u.id = uid;

    if v_email is null or not exists (
      select 1 from private.admin_allowlist a where a.email = v_email
    ) then
      raise exception 'Este e-mail não está autorizado como administrador. Escolher Admin no cadastro não concede acesso. Inclua o e-mail de Matheus ou de Andresa na allowlist do banco e tente de novo.';
    end if;

    update public.profiles
    set role = 'admin', unit_id = null
    where id = uid;

    return jsonb_build_object('role', 'admin', 'unit_id', null);
  end if;

  if v_code !~ '^[A-Z0-9]{6,12}$' then
    raise exception 'Informe o código de convite da unidade.';
  end if;

  select * into v_invite
  from public.invite_codes
  where code = v_code
  for update;

  if not found
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= pg_catalog.now()
     or v_invite.uses >= v_invite.max_uses
     or v_invite.target_role <> v_level then
    raise exception 'Código inválido, expirado, revogado ou incompatível com o nível escolhido.';
  end if;

  update public.invite_codes
  set uses = uses + 1
  where id = v_invite.id;

  update public.profiles
  set role = v_level, unit_id = v_invite.unit_id
  where id = uid;

  v_name := coalesce(nullif(btrim(v_profile.full_name), ''), 'Colaborador');

  insert into public.collaborators (unit_id, profile_id, full_name, job_title, operational_phone, status)
  values (
    v_invite.unit_id,
    uid,
    v_name,
    case when v_level = 'gerente' then 'Gerente' else 'Colaborador' end,
    v_profile.phone,
    'ativo'
  )
  on conflict (profile_id) do update
  set unit_id = excluded.unit_id,
      full_name = excluded.full_name,
      job_title = excluded.job_title,
      operational_phone = coalesce(public.collaborators.operational_phone, excluded.operational_phone),
      status = 'ativo';

  return jsonb_build_object('role', v_level, 'unit_id', v_invite.unit_id);
end;
$$;

create or replace function public.create_invite(
  p_unit_id uuid,
  p_target_role text,
  p_max_uses integer default 1,
  p_valid_days integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_role text := private.caller_role();
  v_target text := lower(btrim(coalesce(p_target_role, '')));
  v_code text;
  v_expires timestamptz;
  v_id uuid;
  attempt integer;
begin
  if uid is null then
    raise exception 'Faça login para gerar um código.';
  end if;

  if v_target not in ('gerente', 'colaborador') then
    raise exception 'O código só pode ser de gerente ou de colaborador.';
  end if;

  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 50 then
    raise exception 'A quantidade de usos deve ficar entre 1 e 50.';
  end if;

  if p_valid_days is null or p_valid_days < 1 or p_valid_days > 30 then
    raise exception 'A validade deve ficar entre 1 e 30 dias.';
  end if;

  if not exists (select 1 from public.units u where u.id = p_unit_id) then
    raise exception 'Unidade não encontrada.';
  end if;

  if v_role = 'admin' then
    null;
  elsif v_role in ('gerente', 'lider') then
    if v_target <> 'colaborador' then
      raise exception 'Gerente só pode gerar código de colaborador da própria unidade.';
    end if;
    if p_unit_id is distinct from private.caller_unit() then
      raise exception 'Gerente só pode gerar código da própria unidade.';
    end if;
  else
    raise exception 'Você não pode gerar códigos de convite.';
  end if;

  v_expires := pg_catalog.now() + make_interval(days => p_valid_days);

  for attempt in 1..8 loop
    v_code := private.generate_invite_code();
    begin
      insert into public.invite_codes (code, unit_id, target_role, max_uses, expires_at, created_by)
      values (v_code, p_unit_id, v_target, p_max_uses, v_expires, uid)
      returning id into v_id;
      exit;
    exception
      when unique_violation then
        if attempt = 8 then
          raise exception 'Não foi possível gerar um código único. Tente de novo.';
        end if;
    end;
  end loop;

  return jsonb_build_object(
    'id', v_id,
    'code', v_code,
    'unit_id', p_unit_id,
    'target_role', v_target,
    'max_uses', p_max_uses,
    'expires_at', v_expires
  );
end;
$$;

create or replace function public.revoke_invite(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_invite public.invite_codes%rowtype;
  v_role text := private.caller_role();
begin
  if uid is null then
    raise exception 'Faça login para revogar um código.';
  end if;

  select * into v_invite from public.invite_codes where id = p_id for update;
  if not found then
    raise exception 'Código não encontrado.';
  end if;

  if v_role = 'admin' then
    null;
  elsif v_role in ('gerente', 'lider')
        and v_invite.target_role = 'colaborador'
        and v_invite.unit_id = private.caller_unit() then
    null;
  else
    raise exception 'Você não pode revogar este código.';
  end if;

  update public.invite_codes
  set revoked_at = coalesce(revoked_at, pg_catalog.now())
  where id = p_id;
end;
$$;

create or replace function public.preview_invite(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_unit_name text;
  v_role text;
begin
  if v_code !~ '^[A-Z0-9]{6,12}$' then
    raise exception 'Código inválido, expirado, revogado ou incompatível com o nível escolhido.';
  end if;

  select u.name, i.target_role
  into v_unit_name, v_role
  from public.invite_codes i
  join public.units u on u.id = i.unit_id
  where i.code = v_code
    and i.revoked_at is null
    and i.expires_at > pg_catalog.now()
    and i.uses < i.max_uses;

  if v_unit_name is null then
    raise exception 'Código inválido, expirado, revogado ou incompatível com o nível escolhido.';
  end if;

  return jsonb_build_object('unit_name', v_unit_name, 'target_role', v_role);
end;
$$;

revoke all on function public.touch_updated_at() from public;
revoke all on function public.protect_profile_access() from public;
revoke all on function public.protect_collaborator_link() from public;
revoke all on function public.enforce_collaborator_unit() from public;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.activate_account(text, text) from public, anon;
revoke all on function public.create_invite(uuid, text, integer, integer) from public, anon;
revoke all on function public.revoke_invite(uuid) from public, anon;
revoke all on function public.preview_invite(text) from public;

grant execute on function public.touch_updated_at() to authenticated;
grant execute on function public.protect_profile_access() to authenticated;
grant execute on function public.protect_collaborator_link() to authenticated;
grant execute on function public.enforce_collaborator_unit() to authenticated;
grant execute on function public.activate_account(text, text) to authenticated;
grant execute on function public.create_invite(uuid, text, integer, integer) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.preview_invite(text) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.handle_new_user() to supabase_auth_admin;
  end if;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists protect_profile_role on public.profiles;
drop trigger if exists protect_profile_access on public.profiles;
create trigger protect_profile_access
  before update on public.profiles
  for each row execute function public.protect_profile_access();

drop trigger if exists touch_units on public.units;
create trigger touch_units
  before update on public.units
  for each row execute function public.touch_updated_at();

drop trigger if exists protect_collaborator_link on public.collaborators;
create trigger protect_collaborator_link
  before insert or update on public.collaborators
  for each row execute function public.protect_collaborator_link();

drop trigger if exists touch_personal_data on public.personal_data;
create trigger touch_personal_data
  before update on public.personal_data
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_schedules on public.schedules;
create trigger touch_schedules
  before update on public.schedules
  for each row execute function public.touch_updated_at();

drop trigger if exists enforce_time_entry_unit on public.time_entries;
create trigger enforce_time_entry_unit
  before insert or update on public.time_entries
  for each row execute function public.enforce_collaborator_unit();

drop trigger if exists enforce_occurrence_unit on public.occurrences;
create trigger enforce_occurrence_unit
  before insert or update on public.occurrences
  for each row execute function public.enforce_collaborator_unit();

alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.collaborators enable row level security;
alter table public.personal_data enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.time_entries enable row level security;
alter table public.occurrences enable row level security;
alter table public.invite_codes enable row level security;

alter table public.units force row level security;
alter table public.profiles force row level security;
alter table public.collaborators force row level security;
alter table public.personal_data force row level security;
alter table public.schedules force row level security;
alter table public.schedule_slots force row level security;
alter table public.time_entries force row level security;
alter table public.occurrences force row level security;
alter table public.invite_codes force row level security;

drop policy if exists units_select_public on public.units;
drop policy if exists units_insert_admin on public.units;
drop policy if exists units_update_admin on public.units;
drop policy if exists units_delete_admin on public.units;
drop policy if exists units_public_read on public.units;
drop policy if exists units_admin_all on public.units;

create policy units_select_public on public.units
  for select to anon, authenticated
  using (true);

create policy units_insert_admin on public.units
  for insert to authenticated
  with check ((select private.is_admin()));

create policy units_update_admin on public.units
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy units_delete_admin on public.units
  for delete to authenticated
  using ((select private.is_admin()));

drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_update_own_or_admin on public.profiles;
drop policy if exists profiles_read_own_or_staff on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;

create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
  );

create policy profiles_update_own_or_admin on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
  )
  with check (
    id = (select auth.uid())
    or (select private.is_admin())
  );

drop policy if exists collaborators_select on public.collaborators;
drop policy if exists collaborators_insert on public.collaborators;
drop policy if exists collaborators_update on public.collaborators;
drop policy if exists collaborators_delete on public.collaborators;

create policy collaborators_select on public.collaborators
  for select to authenticated
  using (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
    or profile_id = (select auth.uid())
  );

create policy collaborators_insert on public.collaborators
  for insert to authenticated
  with check (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  );

create policy collaborators_update on public.collaborators
  for update to authenticated
  using (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
    or profile_id = (select auth.uid())
  )
  with check (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
    or profile_id = (select auth.uid())
  );

create policy collaborators_delete on public.collaborators
  for delete to authenticated
  using ((select private.is_admin()));

drop policy if exists personal_data_select_admin on public.personal_data;
drop policy if exists personal_data_insert_admin on public.personal_data;
drop policy if exists personal_data_update_admin on public.personal_data;
drop policy if exists personal_data_delete_admin on public.personal_data;

create policy personal_data_select_admin on public.personal_data
  for select to authenticated
  using ((select private.is_admin()));

create policy personal_data_insert_admin on public.personal_data
  for insert to authenticated
  with check ((select private.is_admin()));

create policy personal_data_update_admin on public.personal_data
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy personal_data_delete_admin on public.personal_data
  for delete to authenticated
  using ((select private.is_admin()));

drop policy if exists schedules_select on public.schedules;
drop policy if exists schedules_insert on public.schedules;
drop policy if exists schedules_update on public.schedules;
drop policy if exists schedules_delete on public.schedules;

create policy schedules_select on public.schedules
  for select to authenticated
  using (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
    or (
      published = true
      and unit_id = (select private.caller_unit())
      and (select private.caller_role()) = 'colaborador'
    )
  );

create policy schedules_insert on public.schedules
  for insert to authenticated
  with check (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  );

create policy schedules_update on public.schedules
  for update to authenticated
  using (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  )
  with check (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  );

create policy schedules_delete on public.schedules
  for delete to authenticated
  using (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  );

drop policy if exists schedule_slots_select on public.schedule_slots;
drop policy if exists schedule_slots_insert on public.schedule_slots;
drop policy if exists schedule_slots_update on public.schedule_slots;
drop policy if exists schedule_slots_delete on public.schedule_slots;

create policy schedule_slots_select on public.schedule_slots
  for select to authenticated
  using (
    exists (
      select 1
      from public.schedules s
      where s.id = schedule_id
        and (
          (select private.is_admin())
          or (select private.is_unit_manager(s.unit_id))
          or (
            s.published = true
            and s.unit_id = (select private.caller_unit())
            and (select private.caller_role()) = 'colaborador'
          )
        )
    )
  );

create policy schedule_slots_insert on public.schedule_slots
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.schedules s
      where s.id = schedule_id
        and (
          (select private.is_admin())
          or (select private.is_unit_manager(s.unit_id))
        )
    )
  );

create policy schedule_slots_update on public.schedule_slots
  for update to authenticated
  using (
    exists (
      select 1
      from public.schedules s
      where s.id = schedule_id
        and (
          (select private.is_admin())
          or (select private.is_unit_manager(s.unit_id))
        )
    )
  )
  with check (
    exists (
      select 1
      from public.schedules s
      where s.id = schedule_id
        and (
          (select private.is_admin())
          or (select private.is_unit_manager(s.unit_id))
        )
    )
  );

create policy schedule_slots_delete on public.schedule_slots
  for delete to authenticated
  using (
    exists (
      select 1
      from public.schedules s
      where s.id = schedule_id
        and (
          (select private.is_admin())
          or (select private.is_unit_manager(s.unit_id))
        )
    )
  );

drop policy if exists time_entries_select on public.time_entries;
drop policy if exists time_entries_insert on public.time_entries;
drop policy if exists time_entries_update on public.time_entries;
drop policy if exists time_entries_delete on public.time_entries;

create policy time_entries_select on public.time_entries
  for select to authenticated
  using (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
    or (select private.owns_collaborator(collaborator_id))
  );

create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  );

create policy time_entries_update on public.time_entries
  for update to authenticated
  using (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  )
  with check (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  );

create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  );

drop policy if exists occurrences_select on public.occurrences;
drop policy if exists occurrences_insert on public.occurrences;
drop policy if exists occurrences_update on public.occurrences;
drop policy if exists occurrences_delete on public.occurrences;

create policy occurrences_select on public.occurrences
  for select to authenticated
  using (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
    or (select private.owns_collaborator(collaborator_id))
  );

create policy occurrences_insert on public.occurrences
  for insert to authenticated
  with check (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  );

create policy occurrences_update on public.occurrences
  for update to authenticated
  using (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  )
  with check (
    (select private.is_admin())
    or (select private.is_unit_manager(unit_id))
  );

create policy occurrences_delete on public.occurrences
  for delete to authenticated
  using ((select private.is_admin()));

drop policy if exists invite_codes_select on public.invite_codes;

create policy invite_codes_select on public.invite_codes
  for select to authenticated
  using (
    (select private.is_admin())
    or (
      (select private.is_unit_manager(unit_id))
      and target_role = 'colaborador'
    )
  );

revoke all on table public.units from public, anon, authenticated;
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.collaborators from public, anon, authenticated;
revoke all on table public.personal_data from public, anon, authenticated;
revoke all on table public.schedules from public, anon, authenticated;
revoke all on table public.schedule_slots from public, anon, authenticated;
revoke all on table public.time_entries from public, anon, authenticated;
revoke all on table public.occurrences from public, anon, authenticated;
revoke all on table public.invite_codes from public, anon, authenticated;

grant select on table public.units to anon, authenticated;
grant insert, update, delete on table public.units to authenticated;
grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.collaborators to authenticated;
grant select, insert, update, delete on table public.personal_data to authenticated;
grant select, insert, update, delete on table public.schedules to authenticated;
grant select, insert, update, delete on table public.schedule_slots to authenticated;
grant select, insert, update, delete on table public.time_entries to authenticated;
grant select, insert, update, delete on table public.occurrences to authenticated;
grant select on table public.invite_codes to authenticated;
