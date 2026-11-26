-- Consulta somente leitura e limitada à equipe de uma unidade para os sócios.
-- Não expõe telefone, documentos, dados pessoais da ficha nem funções de escrita do RH.
create function public.admin_unit_people_snapshot(p_token text, p_unit_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_unit_id uuid;
  v_unit_name text;
begin
  if not private.valid_admin_session(p_token) then
    raise exception 'Sessão administrativa expirada. Entre novamente.';
  end if;
  select u.id, u.name into v_unit_id, v_unit_name
  from public.units u
  where lower(u.name) = lower(btrim(coalesce(p_unit_name, '')))
  limit 1;
  if v_unit_id is null then raise exception 'Unidade não encontrada.'; end if;

  return jsonb_build_object(
    'unit_name', v_unit_name,
    'people', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'full_name', c.full_name,
        'job_title', c.job_title, 'status', c.status
      ) order by c.status, c.full_name), '[]'::jsonb)
      from public.collaborators c where c.unit_id = v_unit_id
    )
  );
end;
$$;
revoke all on function public.admin_unit_people_snapshot(text, text) from public;
grant execute on function public.admin_unit_people_snapshot(text, text) to anon, authenticated;
