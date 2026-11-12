-- Uma candidatura por CPF em cada vaga. O CPF deixa de viver só no texto da ficha.

alter table public.candidatos
  add column if not exists cpf text;

update public.candidatos
set cpf = nullif(regexp_replace(
  substring(coalesce(info_complementar, '') from 'CPF:[[:space:]]*([0-9.\-]{11,18})'),
  '[^0-9]',
  '',
  'g'
), '')
where cpf is null;

update public.candidatos
set cpf = null
where cpf is not null and cpf !~ '^[0-9]{11}$';

delete from public.candidatos as older
using public.candidatos as newer
where older.cpf is not null
  and newer.cpf = older.cpf
  and newer.vaga_id = older.vaga_id
  and newer.criado_em > older.criado_em;

alter table public.candidatos drop constraint if exists candidatos_cpf_digits;
alter table public.candidatos
  add constraint candidatos_cpf_digits
  check (cpf is null or cpf ~ '^[0-9]{11}$');

drop index if exists candidatos_vaga_cpf_unique;
create unique index candidatos_vaga_cpf_unique
  on public.candidatos (vaga_id, cpf)
  where cpf is not null;
