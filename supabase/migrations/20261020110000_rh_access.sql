-- Acesso do RH. A senha fica só como hash. Trocar o login exige a senha atual.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.staff_access (
  id text primary key,
  email text not null,
  password_hash text not null,
  updated_at timestamptz not null default now(),
  constraint staff_access_id_check check (id = 'rh'),
  constraint staff_access_email_unique unique (email)
);

alter table public.staff_access enable row level security;
revoke all on table public.staff_access from public, anon, authenticated;

insert into public.staff_access (id, email, password_hash)
values ('rh', 'rh@panelavelha.com', extensions.crypt('rh123', extensions.gen_salt('bf')))
on conflict (id) do nothing;

create or replace function public.rh_sign_in(p_email text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  matches boolean;
begin
  select exists (
    select 1
    from public.staff_access
    where id = 'rh'
      and lower(email) = lower(btrim(coalesce(p_email, '')))
      and password_hash = crypt(coalesce(p_password, ''), password_hash)
  ) into matches;
  return matches;
end;
$$;

create or replace function public.rh_change_access(p_current text, p_email text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  next_email text := lower(btrim(coalesce(p_email, '')));
begin
  if not exists (
    select 1 from public.staff_access
    where id = 'rh' and password_hash = crypt(coalesce(p_current, ''), password_hash)
  ) then
    raise exception 'A senha atual não confere.';
  end if;
  if next_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;
  if next_email = 'admin@panelavelha.com' then
    raise exception 'Esse e-mail é da administração.';
  end if;
  if char_length(coalesce(p_password, '')) < 6 then
    raise exception 'A nova senha precisa ter pelo menos 6 caracteres.';
  end if;
  update public.staff_access
  set email = next_email,
      password_hash = crypt(p_password, gen_salt('bf')),
      updated_at = now()
  where id = 'rh';
end;
$$;

revoke all on function public.rh_sign_in(text, text) from public;
revoke all on function public.rh_change_access(text, text, text) from public;
grant execute on function public.rh_sign_in(text, text) to anon, authenticated;
grant execute on function public.rh_change_access(text, text, text) to anon, authenticated;
