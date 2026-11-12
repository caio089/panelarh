-- A ficha não pode usar SELECT * / id sem alias: o PostgREST junta units e collaborators.
drop function if exists public.rh_collaborator_dossier(text, uuid);

create function public.rh_collaborator_dossier(p_token text, p_collaborator_id uuid)
returns table (
  id uuid,
  unit_name text,
  full_name text,
  job_title text,
  status text,
  hired_on date,
  operational_phone text,
  cpf text,
  birth_date date,
  birth_place text,
  email text,
  pix_key text,
  address_line text,
  neighborhood text,
  city_state text,
  postal_code text,
  ctps_number text,
  ctps_series text,
  ctps_state text,
  esocial_registration text,
  contract_type text,
  contractual_salary text,
  dependents integer,
  children_count integer,
  family_allowance text,
  company_cnpj text
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
  select
    c.id,
    u.name,
    c.full_name,
    c.job_title,
    c.status,
    c.hired_on,
    c.operational_phone,
    c.cpf,
    c.birth_date,
    c.birth_place,
    c.email,
    c.pix_key,
    c.address_line,
    c.neighborhood,
    c.city_state,
    c.postal_code,
    c.ctps_number,
    c.ctps_series,
    c.ctps_state,
    c.esocial_registration,
    c.contract_type,
    c.contractual_salary,
    c.dependents,
    c.children_count,
    c.family_allowance,
    c.company_cnpj
  from public.collaborators as c
  left join public.units as u on u.id = c.unit_id
  where c.id = p_collaborator_id;
end;
$$;

revoke all on function public.rh_collaborator_dossier(text, uuid) from public;
grant execute on function public.rh_collaborator_dossier(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
