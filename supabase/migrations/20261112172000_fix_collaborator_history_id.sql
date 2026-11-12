-- RETURNS TABLE (id ...) transforma "id" em variável da função.
-- O WHERE sem alias gerava: column reference "id" is ambiguous.
create or replace function public.rh_list_collaborator_history(p_token text, p_collaborator_id uuid)
returns table (id uuid, event_type text, event_date date, title text, summary text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.valid_rh_session(p_token) then
    raise exception 'Sessão do RH expirada. Entre novamente.';
  end if;

  if not exists (
    select 1 from public.collaborators as c where c.id = p_collaborator_id
  ) then
    raise exception 'Colaborador não encontrado.';
  end if;

  return query
  select h.id, h.event_type, h.event_date, h.title, h.summary, h.created_at
  from public.collaborator_history_events as h
  where h.collaborator_id = p_collaborator_id
  order by h.event_date desc, h.created_at desc;
end;
$$;
