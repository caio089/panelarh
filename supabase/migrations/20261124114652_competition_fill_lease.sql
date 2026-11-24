-- Only the Vercel worker receives this capability. The schema is outside the Data API.
create schema competition_worker;
revoke all on schema competition_worker from public;
grant usage on schema competition_worker to anon;

create table competition_worker.fill_leases (
  unit_id text primary key,
  available_at timestamptz not null default '-infinity',
  worker_key uuid not null
);

with credential as materialized (select gen_random_uuid() as key)
insert into competition_worker.fill_leases (unit_id, worker_key)
select unit_id, key from unnest(array['dirceu', 'promorar', 'mocambinho']) as unit_id
cross join credential;

alter table competition_worker.fill_leases enable row level security;
revoke all on competition_worker.fill_leases from public, anon, authenticated;
grant select (unit_id, available_at), update (available_at) on competition_worker.fill_leases to anon;

create policy worker_may_claim on competition_worker.fill_leases
  for all to anon
  using (worker_key::text = (select nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-competition-worker'))
  with check (worker_key::text = (select nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-competition-worker'));

-- PostgreSQL rechecks the predicate after a concurrent UPDATE commits. No connection
-- or transaction stays open during the Saipos request; a crashed worker expires.
create function public.claim_competition_fill(p_unit_id text)
returns boolean
language sql volatile security invoker set search_path = ''
as $$
  with claimed as (
    update competition_worker.fill_leases
       set available_at = statement_timestamp() + interval '75 seconds'
     where unit_id = p_unit_id and available_at <= statement_timestamp()
    returning 1
  )
  select exists (select 1 from claimed)
$$;
revoke all on function public.claim_competition_fill(text) from public, authenticated;
grant execute on function public.claim_competition_fill(text) to anon;
