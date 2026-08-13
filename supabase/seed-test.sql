-- Dados de teste (Panela Velha). Idempotente: on conflict do nothing.

insert into public.units (id, name) values
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Mocambinho'),
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'Morada do Sol')
on conflict (name) do nothing;

-- Vagas de operação (usa unidade Dirceu / Norte / Mocambinho se existirem)
insert into public.vagas (
  id, unit_id, titulo, descricao, localidade, tipo, ativa,
  salario, horario, regime, responsabilidades, requisitos, diferenciais, beneficios
)
select
  v.id,
  u.id,
  v.titulo,
  v.descricao,
  v.localidade,
  'Presencial',
  true,
  v.salario,
  v.horario,
  'CLT',
  v.responsabilidades,
  v.requisitos,
  v.diferenciais,
  v.beneficios
from (
  values
    (
      'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1'::uuid,
      'unidade dirceu',
      'Chapeiro',
      'Responsável pela produção na chapa, padronização dos pratos e ritmo de casa cheia, com foco em qualidade e segurança alimentar.',
      'Dirceu · Teresina',
      'A combinar + benefícios',
      'Escala 6x1 · turnos de 8h',
      E'• Preparar e montar os pratos da chapa com padrão da casa\n• Controlar ponto, temperatura e apresentação\n• Manter a estação organizada e abastecida\n• Seguir fichas técnicas e higiene',
      E'• Experiência em chapa, grill ou cozinha de volume\n• Disponibilidade para turnos e finais de semana\n• Agilidade e trabalho em equipe',
      E'• Conhecimento de fichas técnicas\n• Experiência em restaurante de alto movimento',
      E'• Alimentação no local\n• Vale-transporte\n• Uniforme fornecido'
    ),
    (
      'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2'::uuid,
      'unidade dirceu',
      'Garçom / Atendente',
      'Atendimento caloroso, hospitalidade e ritmo de casa cheia — a experiência do cliente começa na mesa.',
      'Dirceu · Teresina',
      'A combinar + gorjetas',
      'Escala 6x1 · almoço e/ou jantar',
      E'• Receber, anotar pedidos e conduzir o atendimento\n• Conhecer o cardápio e sugerir pratos\n• Manter mesas organizadas\n• Trabalhar com cozinha e caixa',
      E'• Boa comunicação e simpatia\n• Disponibilidade para finais de semana\n• Agilidade',
      E'• Experiência em restaurante ou bar',
      E'• Alimentação no local\n• Vale-transporte\n• Uniforme fornecido'
    ),
    (
      'b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3'::uuid,
      'unidade dirceu',
      'Operador de Caixa',
      'Atendimento no caixa com precisão, cordialidade e fila andando.',
      'Dirceu · Teresina',
      'A combinar + benefícios',
      'Escala 6x1 · turnos de 8h',
      E'• Registrar pedidos e receber pagamentos\n• Conferir caixa no início e no fim do turno\n• Atender com clareza e simpatia',
      E'• Atenção a números e organização\n• Boa comunicação\n• Disponibilidade para FDS',
      E'• Experiência com PDV',
      E'• Alimentação no local\n• Vale-transporte\n• Uniforme fornecido'
    ),
    (
      'b4b4b4b4-b4b4-b4b4-b4b4-b4b4b4b4b4b4'::uuid,
      'Unidade Norte',
      'Auxiliar de Cozinha',
      'Apoio à produção, organização e limpeza para o time da cozinha render com qualidade.',
      'Norte · Teresina',
      'A combinar + benefícios',
      'Escala 6x1 · turnos de 8h',
      E'• Apoiar mise en place e pré-preparo\n• Manter louças e área de apoio em ordem\n• Abastecer estações durante o serviço',
      E'• Vontade de aprender\n• Disponibilidade para turnos e FDS\n• Organização',
      E'• Experiência prévia em restaurante',
      E'• Alimentação no local\n• Vale-transporte\n• Uniforme fornecido'
    ),
    (
      'b5b5b5b5-b5b5-b5b5-b5b5-b5b5b5b5b5b5'::uuid,
      'Mocambinho',
      'Gerente de Loja',
      'Liderança da operação, gente e indicadores — para a casa funcionar com padrão, ritmo e hospitalidade.',
      'Mocambinho · Teresina',
      'A combinar + benefícios',
      'Escala da operação',
      E'• Liderar a equipe do salão e da cozinha\n• Acompanhar qualidade e tempo de serviço\n• Controlar escala, ponto e clima do time\n• Cuidar de estoque e custos',
      E'• Experiência em liderança de restaurante\n• Disponibilidade para horários de operação\n• Boa comunicação e decisão',
      E'• Indicadores de loja (CMV, ticket)\n• Experiência com múltiplos turnos',
      E'• Alimentação no local\n• Vale-transporte\n• Uniforme fornecido'
    )
) as v(id, unit_name, titulo, descricao, localidade, salario, horario, responsabilidades, requisitos, diferenciais, beneficios)
join public.units u on lower(u.name) = lower(v.unit_name)
on conflict (id) do nothing;

insert into public.candidatos (
  id, vaga_id, nome, status, experiencia, info_complementar, criado_em
) values
  (
    'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
    'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
    'Maria Santos',
    'entrevista',
    'Chapeira há 4 anos em restaurante de alto movimento. Experiência com grill, fichas técnicas e pico de almoço.',
    'WhatsApp: (86) 98811-1001 · Bairro: Dirceu · Turnos: Manhã, Tarde · DISC D62 I40 S48 C70',
    now() - interval '12 days'
  ),
  (
    'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2',
    'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
    'João Pereira',
    'pendente',
    'Auxiliar de cozinha há 2 anos, buscando chapa. Já cobriu grill em finais de semana.',
    'WhatsApp: (86) 98811-1002 · Bairro: Promorar · Turnos: Tarde, Noite · DISC D55 I35 S60 C58',
    now() - interval '8 days'
  ),
  (
    'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3',
    'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1',
    'Ana Lima',
    'aprovada',
    'Chapeira e pizzaiola. 6 anos de cozinha, ritmo forte e padrão de montagem.',
    'WhatsApp: (86) 98811-1003 · Bairro: Mocambinho · Turnos: Manhã, Tarde, Noite · DISC D70 I38 S45 C72',
    now() - interval '20 days'
  ),
  (
    'c4c4c4c4-c4c4-c4c4-c4c4-c4c4c4c4c4c4',
    'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
    'Pedro Alves',
    'pendente',
    'Atendente de salão há 1 ano. Gosta de hospitalidade e casa cheia.',
    'WhatsApp: (86) 98811-1004 · Bairro: Centro · Turnos: Tarde, Noite · DISC D40 I78 S62 C44',
    now() - interval '3 days'
  ),
  (
    'c5c5c5c5-c5c5-c5c5-c5c5-c5c5c5c5c5c5',
    'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
    'Carla Souza',
    'entrevista',
    'Garçonete há 5 anos em restaurante e bar. Cardápio, sugestão de pratos e ritmo de jantar.',
    'WhatsApp: (86) 98811-1005 · Bairro: Dirceu · Turnos: Noite · DISC D48 I82 S70 C50',
    now() - interval '9 days'
  ),
  (
    'c6c6c6c6-c6c6-c6c6-c6c6-c6c6c6c6c6c6',
    'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2',
    'Lucas Mendes',
    'banco',
    'Primeiro emprego em atendimento. Simpático, sem experiência em restaurante.',
    'WhatsApp: (86) 98811-1006 · Bairro: Buenos Aires · Turnos: Manhã · DISC D30 I65 S55 C40',
    now() - interval '15 days'
  ),
  (
    'c7c7c7c7-c7c7-c7c7-c7c7-c7c7c7c7c7c7',
    'b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3',
    'Fernanda Costa',
    'pendente',
    'Operadora de caixa em supermercado por 3 anos. PDV, fechamento e fila.',
    'WhatsApp: (86) 98811-1007 · Bairro: Morada do Sol · Turnos: Manhã, Tarde · DISC D45 I60 S68 C75',
    now() - interval '5 days'
  ),
  (
    'c8c8c8c8-c8c8-c8c8-c8c8-c8c8c8c8c8c8',
    'b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3',
    'Rafael Dias',
    'entrevista',
    'Caixa de restaurante há 2 anos. Conferência de caixa e atendimento no balcão.',
    'WhatsApp: (86) 98811-1008 · Bairro: Dirceu · Turnos: Tarde, Noite · DISC D50 I72 S58 C80',
    now() - interval '11 days'
  ),
  (
    'c9c9c9c9-c9c9-c9c9-c9c9-c9c9c9c9c9c9',
    'b4b4b4b4-b4b4-b4b4-b4b4-b4b4b4b4b4b4',
    'Beatriz Rocha',
    'pendente',
    'Auxiliar de cozinha e lavagem. Organização, mise en place e apoio no pico.',
    'WhatsApp: (86) 98811-1009 · Bairro: Norte · Turnos: Manhã, Tarde · DISC D42 I40 S75 C60',
    now() - interval '4 days'
  ),
  (
    'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0',
    'b4b4b4b4-b4b4-b4b4-b4b4-b4b4b4b4b4b4',
    'Thiago Nunes',
    'reprovada',
    'Sem experiência em cozinha. Disponibilidade parcial.',
    'WhatsApp: (86) 98811-1010 · Bairro: Centro · Turnos: Manhã · DISC D28 I33 S40 C35',
    now() - interval '18 days'
  ),
  (
    'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1',
    'b5b5b5b5-b5b5-b5b5-b5b5-b5b5b5b5b5b5',
    'Patrícia Gomes',
    'entrevista',
    'Gerente de restaurante há 7 anos. Escala, CMV, equipe de 20 pessoas e operação de almoço/jantar.',
    'WhatsApp: (86) 98811-1011 · Bairro: Mocambinho · Turnos: Manhã, Tarde, Noite · DISC D78 I55 S50 C74',
    now() - interval '7 days'
  ),
  (
    'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2',
    'b5b5b5b5-b5b5-b5b5-b5b5-b5b5b5b5b5b5',
    'Eduardo Martins',
    'pendente',
    'Supervisor de salão há 3 anos. Liderança de turno e indicadores de ticket médio.',
    'WhatsApp: (86) 98811-1012 · Bairro: Dirceu · Turnos: Tarde, Noite · DISC D66 I60 S52 C68',
    now() - interval '2 days'
  )
on conflict (id) do nothing;
