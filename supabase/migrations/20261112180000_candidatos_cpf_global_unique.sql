-- Uma candidatura por CPF no painel, em qualquer vaga.

delete from public.candidatos as older
using public.candidatos as newer
where older.cpf is not null
  and newer.cpf = older.cpf
  and newer.criado_em > older.criado_em;

drop index if exists candidatos_vaga_cpf_unique;
drop index if exists candidatos_cpf_unique;

create unique index candidatos_cpf_unique
  on public.candidatos (cpf)
  where cpf is not null;
