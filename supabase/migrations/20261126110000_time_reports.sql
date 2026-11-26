-- Espelhos de ponto e extratos oficiais do banco de horas por unidade e período.
-- O PDF fica com o operador; apenas os dados necessários à conferência são gravados.
create table public.time_reports (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete restrict,
  kind text not null check (kind in ('espelho', 'banco')),
  period_from date not null,
  period_to date not null,
  company_name text not null,
  source_file text not null,
  people jsonb not null,
  imported_at timestamptz not null default now(),
  constraint time_reports_dates_chk check (period_to >= period_from and period_to <= period_from + 92),
  constraint time_reports_people_chk check (jsonb_typeof(people) = 'array'),
  unique (unit_id, kind, period_from, period_to)
);
create index time_reports_unit_period_idx on public.time_reports (unit_id, period_to desc);
alter table public.time_reports enable row level security;
revoke all on public.time_reports from public, anon, authenticated;

create function public.rh_list_time_reports(p_token text, p_unit_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
begin
  if not private.valid_rh_session(p_token) then raise exception 'Sessão do RH expirada. Entre novamente.'; end if;
  if not exists (select 1 from public.units where id = p_unit_id) then raise exception 'Unidade inválida.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.period_to desc, r.imported_at desc)
    from public.time_reports r where r.unit_id = p_unit_id), '[]'::jsonb);
end;
$$;

create function public.rh_save_time_report(
  p_token text, p_unit_id uuid, p_kind text, p_from date, p_to date,
  p_company text, p_filename text, p_people jsonb
) returns uuid language plpgsql security definer set search_path = public, private as $$
declare v_id uuid; v_person jsonb; v_collaborator uuid;
begin
  if not private.valid_rh_session(p_token) then raise exception 'Sessão do RH expirada. Entre novamente.'; end if;
  if not exists (select 1 from public.units where id = p_unit_id) then raise exception 'Unidade inválida.'; end if;
  if p_kind not in ('espelho', 'banco') or p_from is null or p_to is null
    or p_to < p_from or p_to > p_from + 92 then raise exception 'Tipo ou período inválido.'; end if;
  if length(btrim(coalesce(p_company, ''))) not between 2 and 160
    or length(btrim(coalesce(p_filename, ''))) not between 1 and 200 then raise exception 'Origem inválida.'; end if;
  if jsonb_typeof(p_people) <> 'array' or jsonb_array_length(p_people) not between 1 and 200
    or length(p_people::text) > 250000 then raise exception 'Dados do relatório inválidos.'; end if;
  for v_person in select value from jsonb_array_elements(p_people) loop
    if jsonb_typeof(v_person) <> 'object'
      or length(btrim(coalesce(v_person->>'sourceName', ''))) not between 2 and 160
      or jsonb_typeof(v_person->'days') <> 'array' then raise exception 'Colaborador do relatório inválido.'; end if;
    if nullif(v_person->>'collaboratorId', '') is not null then
      begin v_collaborator := (v_person->>'collaboratorId')::uuid;
      exception when invalid_text_representation then raise exception 'Vínculo de colaborador inválido.'; end;
      if not exists (select 1 from public.collaborators c where c.id = v_collaborator and c.unit_id = p_unit_id)
        then raise exception 'Colaborador não pertence à unidade.'; end if;
    end if;
  end loop;
  insert into public.time_reports (unit_id, kind, period_from, period_to, company_name, source_file, people)
  values (p_unit_id, p_kind, p_from, p_to, btrim(p_company), btrim(p_filename), p_people)
  on conflict (unit_id, kind, period_from, period_to) do update
    set company_name = excluded.company_name, source_file = excluded.source_file,
        people = excluded.people, imported_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.rh_list_time_reports(text, uuid) from public;
revoke all on function public.rh_save_time_report(text, uuid, text, date, date, text, text, jsonb) from public;
grant execute on function public.rh_list_time_reports(text, uuid) to anon, authenticated;
grant execute on function public.rh_save_time_report(text, uuid, text, date, date, text, text, jsonb) to anon, authenticated;
