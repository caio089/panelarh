-- Vagas do site público e do painel. A mesma tabela recebe o cadastro e alimenta a lista.

insert into public.units (name)
select house.name
from (values ('Dirceu'), ('Promorar'), ('Mocambinho')) as house(name)
where not exists (
  select 1 from public.units existing where lower(existing.name) = lower(house.name)
);

create table if not exists public.vagas (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  titulo text not null,
  descricao text,
  localidade text,
  tipo text not null default 'Presencial',
  ativa boolean not null default true,
  criada_em timestamptz not null default now(),
  salario text,
  horario text,
  regime text,
  responsabilidades text,
  requisitos text,
  diferenciais text,
  beneficios text,
  constraint vagas_titulo_len check (char_length(btrim(titulo)) between 2 and 120)
);

create index if not exists vagas_unit_id_idx on public.vagas (unit_id);
create index if not exists vagas_ativa_idx on public.vagas (ativa);

alter table public.vagas enable row level security;

drop policy if exists vagas_read on public.vagas;
drop policy if exists vagas_insert on public.vagas;
drop policy if exists vagas_update on public.vagas;
drop policy if exists vagas_delete on public.vagas;

create policy vagas_read on public.vagas
  for select to anon, authenticated
  using (true);

create policy vagas_insert on public.vagas
  for insert to anon, authenticated
  with check (true);

create policy vagas_update on public.vagas
  for update to anon, authenticated
  using (true)
  with check (true);

create policy vagas_delete on public.vagas
  for delete to anon, authenticated
  using (true);

grant select, insert, update, delete on public.vagas to anon, authenticated;

insert into public.vagas (
  unit_id, titulo, descricao, localidade, tipo, ativa, criada_em,
  salario, horario, regime, responsabilidades, requisitos, diferenciais, beneficios
)
select
  unit.id,
  job.titulo,
  job.descricao,
  job.localidade,
  'Presencial',
  true,
  timestamptz '2026-10-18 12:00:00+00',
  'A combinar',
  job.horario,
  'CLT',
  job.responsabilidades,
  job.requisitos,
  job.diferenciais,
  'Refeição no turno.'
from public.units unit
join (
  values
    (
      'Atendente de salão (teste)',
      'Vaga de teste para o salão do Dirceu. Atende a mesa, anota o pedido e entrega a pizza.',
      'Dirceu, Teresina',
      '17:30 às 23:30',
      'Receber o cliente, lançar o pedido e acompanhar a mesa até a conta.',
      'Disponibilidade à noite e no fim de semana.',
      'Experiência em salão.'
    ),
    (
      'Pizzaiolo (teste)',
      'Vaga de teste para a cozinha do Dirceu. Monta e assa as pizzas no forno.',
      'Dirceu, Teresina',
      '16:00 às 00:00',
      'Abrir massas, montar os sabores e cuidar do ponto de cada pizza.',
      'Já ter trabalhado em forno ou cozinha quente.',
      'Conhecer a ficha da casa.'
    ),
    (
      'Auxiliar de cozinha (teste)',
      'Vaga de teste para o apoio da cozinha do Dirceu. Prepara insumos e organiza a praça.',
      'Dirceu, Teresina',
      '15:00 às 23:00',
      'Porcionar ingredientes, manter a praça limpa e apoiar o pizzaiolo.',
      'Disposição para o turno da noite.',
      'Experiência em cozinha.'
    )
) as job(titulo, descricao, localidade, horario, responsabilidades, requisitos, diferenciais) on true
where unit.name = 'Dirceu'
  and not exists (
    select 1 from public.vagas existing
    where existing.unit_id = unit.id and existing.titulo = job.titulo
  );
