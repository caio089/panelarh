-- Panela RH — schema completo (rode no SQL Editor do Supabase)
-- Compatível com o protótipo anterior (units / vagas / candidatos)

create extension if not exists "pgcrypto";

-- Unidades
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Vagas
create table if not exists public.vagas (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  titulo text not null,
  descricao text,
  localidade text,
  tipo text default 'Presencial',
  ativa boolean default true,
  criada_em timestamptz default now()
);

-- Perfis (auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'candidate'
    check (role in ('candidate', 'admin', 'lider')),
  unit_id uuid references public.units(id) on delete set null,
  phone text,
  cpf text,
  city text,
  birth_date date,
  desired_role text,
  availability text,
  salary_expectation text,
  linkedin text,
  disc_d numeric default 0,
  disc_i numeric default 0,
  disc_s numeric default 0,
  disc_c numeric default 0,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Experiências profissionais
create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  role_title text not null,
  start_date text,
  end_date text,
  description text,
  created_at timestamptz default now()
);

-- Respostas DISC
create table if not exists public.disc_answers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  question_key text not null,
  value int not null check (value between 1 and 5),
  unique (profile_id, question_key)
);

-- Candidatos / candidaturas
create table if not exists public.candidatos (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references public.vagas(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  nome text not null,
  info_complementar text,
  experiencia text,
  referencia text,
  status text not null default 'pendente'
    check (status in ('pendente', 'entrevista', 'aprovada', 'reprovada', 'banco')),
  data_inicio_treinamento date,
  curriculo_url text,
  curriculo_nome text,
  criado_em timestamptz default now()
);

-- Mensagens / notificações ao candidato
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid not null references public.candidatos(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);

-- Colunas extras se a tabela já existia
alter table public.vagas add column if not exists descricao text;
alter table public.vagas add column if not exists localidade text;
alter table public.vagas add column if not exists tipo text default 'Presencial';
alter table public.vagas add column if not exists ativa boolean default true;
alter table public.candidatos add column if not exists profile_id uuid references public.profiles(id) on delete set null;

-- Trigger: cria profile ao cadastrar usuário
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'candidate'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impede o app de rebaixar admin/lider via update do próprio perfil
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.jwt() is not null and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Storage
insert into storage.buckets (id, name, public)
values ('curriculos', 'curriculos', true)
on conflict (id) do nothing;

-- RLS
alter table public.units enable row level security;
alter table public.vagas enable row level security;
alter table public.profiles enable row level security;
alter table public.experiences enable row level security;
alter table public.disc_answers enable row level security;
alter table public.candidatos enable row level security;
alter table public.messages enable row level security;

-- Helpers
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'lider')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Policies (drop + recreate para idempotência)
do $$ begin
  -- units
  drop policy if exists "units_public_read" on public.units;
  drop policy if exists "units_admin_all" on public.units;
  create policy "units_public_read" on public.units for select using (true);
  create policy "units_admin_all" on public.units for all using (public.is_admin());

  -- vagas
  drop policy if exists "vagas_public_read_active" on public.vagas;
  drop policy if exists "vagas_staff_all" on public.vagas;
  create policy "vagas_public_read_active" on public.vagas
    for select using (ativa = true or public.is_staff());
  create policy "vagas_staff_all" on public.vagas
    for all using (public.is_staff());

  -- profiles
  drop policy if exists "profiles_read_own_or_staff" on public.profiles;
  drop policy if exists "profiles_update_own" on public.profiles;
  drop policy if exists "profiles_admin_all" on public.profiles;
  create policy "profiles_read_own_or_staff" on public.profiles
    for select using (id = auth.uid() or public.is_staff());
  create policy "profiles_update_own" on public.profiles
    for update using (id = auth.uid() or public.is_admin());
  create policy "profiles_admin_all" on public.profiles
    for all using (public.is_admin());

  -- experiences
  drop policy if exists "exp_own_or_staff" on public.experiences;
  create policy "exp_own_or_staff" on public.experiences
    for all using (profile_id = auth.uid() or public.is_staff());

  -- disc
  drop policy if exists "disc_own_or_staff" on public.disc_answers;
  create policy "disc_own_or_staff" on public.disc_answers
    for all using (profile_id = auth.uid() or public.is_staff());

  -- candidatos
  drop policy if exists "cand_public_insert_auth" on public.candidatos;
  drop policy if exists "cand_read_own_or_staff" on public.candidatos;
  drop policy if exists "cand_staff_all" on public.candidatos;
  create policy "cand_read_own_or_staff" on public.candidatos
    for select using (profile_id = auth.uid() or public.is_staff());
  create policy "cand_public_insert_auth" on public.candidatos
    for insert with check (auth.uid() is not null);
  create policy "cand_staff_all" on public.candidatos
    for all using (public.is_staff());

  -- messages
  drop policy if exists "msg_read_related" on public.messages;
  drop policy if exists "msg_staff_insert" on public.messages;
  create policy "msg_read_related" on public.messages
    for select using (
      public.is_staff()
      or exists (
        select 1 from public.candidatos c
        where c.id = candidato_id and c.profile_id = auth.uid()
      )
    );
  create policy "msg_staff_insert" on public.messages
    for insert with check (public.is_staff());
end $$;

-- Atualiza constraint de status se a tabela já existia
alter table public.candidatos drop constraint if exists candidatos_status_check;
alter table public.candidatos
  add constraint candidatos_status_check
  check (status in ('pendente', 'entrevista', 'aprovada', 'reprovada', 'banco'));

-- Grants: helpers usados nas policies RLS (anon precisa para avaliar USING)
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- Unidades e vagas são cadastradas pelo admin no painel (sem seed).

-- Admin de produção: criar usuário em Authentication e depois:
-- update public.profiles set role = 'admin' where email = 'seu-admin@email.com';

-- Detalhes enriquecidos da vaga (página pública)
alter table public.vagas
  add column if not exists salario text,
  add column if not exists horario text,
  add column if not exists regime text default 'CLT',
  add column if not exists responsabilidades text,
  add column if not exists requisitos text,
  add column if not exists diferenciais text,
  add column if not exists beneficios text;

-- Campos do formulário "Vem trabalhar com a gente!"
alter table public.profiles
  add column if not exists about_me text,
  add column if not exists weekend_availability text,
  add column if not exists shifts text,
  add column if not exists preferred_unit text,
  add column if not exists relevant_experience text,
  add column if not exists why_company text,
  add column if not exists has_transport text;

