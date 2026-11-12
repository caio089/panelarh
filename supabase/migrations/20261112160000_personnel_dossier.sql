-- Ficha do departamento pessoal. A leitura continua só pela sessão do RH.

alter table public.collaborators
  add column if not exists cpf text,
  add column if not exists birth_date date,
  add column if not exists birth_place text,
  add column if not exists email text,
  add column if not exists pix_key text,
  add column if not exists address_line text,
  add column if not exists neighborhood text,
  add column if not exists city_state text,
  add column if not exists postal_code text,
  add column if not exists ctps_number text,
  add column if not exists ctps_series text,
  add column if not exists ctps_state text,
  add column if not exists esocial_registration text,
  add column if not exists contract_type text,
  add column if not exists contractual_salary text,
  add column if not exists dependents integer,
  add column if not exists children_count integer,
  add column if not exists family_allowance text,
  add column if not exists company_cnpj text;

create unique index if not exists collaborators_cpf_unique
  on public.collaborators (cpf)
  where cpf is not null;

alter table public.collaborators drop constraint if exists collaborators_dependents_chk;
alter table public.collaborators
  add constraint collaborators_dependents_chk
  check (dependents is null or dependents between 0 and 20);

alter table public.collaborators drop constraint if exists collaborators_children_chk;
alter table public.collaborators
  add constraint collaborators_children_chk
  check (children_count is null or children_count between 0 and 20);

create or replace function public.rh_collaborator_dossier(p_token text, p_collaborator_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_row public.collaborators%rowtype;
  v_unit text;
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;

  select * into v_row from public.collaborators where id = p_collaborator_id;
  if v_row.id is null then
    raise exception 'Colaborador não encontrado.';
  end if;

  select name into v_unit from public.units where id = v_row.unit_id;

  return jsonb_build_object(
    'id', v_row.id,
    'unit_name', v_unit,
    'full_name', v_row.full_name,
    'job_title', v_row.job_title,
    'status', v_row.status,
    'hired_on', v_row.hired_on,
    'operational_phone', v_row.operational_phone,
    'cpf', v_row.cpf,
    'birth_date', v_row.birth_date,
    'birth_place', v_row.birth_place,
    'email', v_row.email,
    'pix_key', v_row.pix_key,
    'address_line', v_row.address_line,
    'neighborhood', v_row.neighborhood,
    'city_state', v_row.city_state,
    'postal_code', v_row.postal_code,
    'ctps_number', v_row.ctps_number,
    'ctps_series', v_row.ctps_series,
    'ctps_state', v_row.ctps_state,
    'esocial_registration', v_row.esocial_registration,
    'contract_type', v_row.contract_type,
    'contractual_salary', v_row.contractual_salary,
    'dependents', v_row.dependents,
    'children_count', v_row.children_count,
    'family_allowance', v_row.family_allowance,
    'company_cnpj', v_row.company_cnpj
  );
end;
$$;

revoke all on function public.rh_collaborator_dossier(text, uuid) from public;
grant execute on function public.rh_collaborator_dossier(text, uuid) to anon, authenticated;
