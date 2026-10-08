import type { Candidato, CandidateStatus, Message, Unit, Vaga } from '@/types'
import type { AppStore } from '@/lib/data'

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS).toISOString()
}

const BENEFICIOS_PADRAO = '• Alimentação no local\n• Vale-transporte\n• Uniforme fornecido'

const UNITS: Unit[] = [
  { id: 'unit-dirceu', name: 'Dirceu' },
  { id: 'unit-mocambinho', name: 'Mocambinho' },
  { id: 'unit-morada-do-sol', name: 'Morada do Sol' },
]

function buildVagas(): Vaga[] {
  return [
    {
      id: 'vaga-chapeiro',
      unit_id: 'unit-dirceu',
      titulo: 'Chapeiro',
      descricao:
        'Responsável pela produção na chapa, padronização dos pratos e ritmo de casa cheia, com foco em qualidade e segurança alimentar.',
      localidade: 'Dirceu · Teresina',
      tipo: 'Presencial',
      ativa: true,
      criada_em: daysAgo(25),
      salario: 'A combinar + benefícios',
      horario: 'Escala 6x1 · turnos de 8h',
      regime: 'CLT',
      responsabilidades:
        '• Preparar e montar os pratos da chapa com padrão da casa\n• Controlar ponto, temperatura e apresentação\n• Manter a estação organizada e abastecida\n• Seguir fichas técnicas e higiene',
      requisitos:
        '• Experiência em chapa, grill ou cozinha de volume\n• Disponibilidade para turnos e finais de semana\n• Agilidade e trabalho em equipe',
      diferenciais: '• Conhecimento de fichas técnicas\n• Experiência em restaurante de alto movimento',
      beneficios: BENEFICIOS_PADRAO,
    },
    {
      id: 'vaga-garcom',
      unit_id: 'unit-dirceu',
      titulo: 'Garçom / Atendente',
      descricao:
        'Atendimento caloroso, hospitalidade e ritmo de casa cheia — a experiência do cliente começa na mesa.',
      localidade: 'Dirceu · Teresina',
      tipo: 'Presencial',
      ativa: true,
      criada_em: daysAgo(20),
      salario: 'A combinar + gorjetas',
      horario: 'Escala 6x1 · almoço e/ou jantar',
      regime: 'CLT',
      responsabilidades:
        '• Receber, anotar pedidos e conduzir o atendimento\n• Conhecer o cardápio e sugerir pratos\n• Manter mesas organizadas\n• Trabalhar com cozinha e caixa',
      requisitos: '• Boa comunicação e simpatia\n• Disponibilidade para finais de semana\n• Agilidade',
      diferenciais: '• Experiência em restaurante ou bar',
      beneficios: BENEFICIOS_PADRAO,
    },
    {
      id: 'vaga-caixa',
      unit_id: 'unit-morada-do-sol',
      titulo: 'Operador de Caixa',
      descricao: 'Atendimento no caixa com precisão, cordialidade e fila andando.',
      localidade: 'Morada do Sol · Teresina',
      tipo: 'Presencial',
      ativa: true,
      criada_em: daysAgo(15),
      salario: 'A combinar + benefícios',
      horario: 'Escala 6x1 · turnos de 8h',
      regime: 'CLT',
      responsabilidades:
        '• Registrar pedidos e receber pagamentos\n• Conferir caixa no início e no fim do turno\n• Atender com clareza e simpatia',
      requisitos: '• Atenção a números e organização\n• Boa comunicação\n• Disponibilidade para FDS',
      diferenciais: '• Experiência com PDV',
      beneficios: BENEFICIOS_PADRAO,
    },
    {
      id: 'vaga-auxiliar',
      unit_id: 'unit-morada-do-sol',
      titulo: 'Auxiliar de Cozinha',
      descricao: 'Apoio à produção, organização e limpeza para o time da cozinha render com qualidade.',
      localidade: 'Morada do Sol · Teresina',
      tipo: 'Presencial',
      ativa: true,
      criada_em: daysAgo(10),
      salario: 'A combinar + benefícios',
      horario: 'Escala 6x1 · turnos de 8h',
      regime: 'CLT',
      responsabilidades:
        '• Apoiar mise en place e pré-preparo\n• Manter louças e área de apoio em ordem\n• Abastecer estações durante o serviço',
      requisitos: '• Vontade de aprender\n• Disponibilidade para turnos e FDS\n• Organização',
      diferenciais: '• Experiência prévia em restaurante',
      beneficios: BENEFICIOS_PADRAO,
    },
    {
      id: 'vaga-gerente',
      unit_id: 'unit-mocambinho',
      titulo: 'Gerente de Loja',
      descricao:
        'Liderança da operação, gente e indicadores — para a casa funcionar com padrão, ritmo e hospitalidade.',
      localidade: 'Mocambinho · Teresina',
      tipo: 'Presencial',
      ativa: true,
      criada_em: daysAgo(8),
      salario: 'A combinar + benefícios',
      horario: 'Escala da operação',
      regime: 'CLT',
      responsabilidades:
        '• Liderar a equipe do salão e da cozinha\n• Acompanhar qualidade e tempo de serviço\n• Controlar escala, ponto e clima do time\n• Cuidar de estoque e custos',
      requisitos:
        '• Experiência em liderança de restaurante\n• Disponibilidade para horários de operação\n• Boa comunicação e decisão',
      diferenciais: '• Indicadores de loja (CMV, ticket)\n• Experiência com múltiplos turnos',
      beneficios: BENEFICIOS_PADRAO,
    },
  ]
}

interface CandidatoSeed {
  id: string
  vagaId: string
  nome: string
  status: CandidateStatus
  experiencia: string
  phone: string
  bairro: string
  turnos: string
  disc: string
  diasAtras: number
}

const CANDIDATOS_SEED: CandidatoSeed[] = [
  { id: 'cand-maria', vagaId: 'vaga-chapeiro', nome: 'Maria Santos', status: 'entrevista', experiencia: 'Chapeira há 4 anos em restaurante de alto movimento. Experiência com grill, fichas técnicas e pico de almoço.', phone: '(86) 98811-1001', bairro: 'Dirceu', turnos: 'Manhã, Tarde', disc: 'D62 I40 S48 C70', diasAtras: 12 },
  { id: 'cand-joao', vagaId: 'vaga-chapeiro', nome: 'João Pereira', status: 'pendente', experiencia: 'Auxiliar de cozinha há 2 anos, buscando chapa. Já cobriu grill em finais de semana.', phone: '(86) 98811-1002', bairro: 'Promorar', turnos: 'Tarde, Noite', disc: 'D55 I35 S60 C58', diasAtras: 8 },
  { id: 'cand-ana', vagaId: 'vaga-chapeiro', nome: 'Ana Lima', status: 'aprovada', experiencia: 'Chapeira e pizzaiola. 6 anos de cozinha, ritmo forte e padrão de montagem.', phone: '(86) 98811-1003', bairro: 'Mocambinho', turnos: 'Manhã, Tarde, Noite', disc: 'D70 I38 S45 C72', diasAtras: 20 },
  { id: 'cand-pedro', vagaId: 'vaga-garcom', nome: 'Pedro Alves', status: 'pendente', experiencia: 'Atendente de salão há 1 ano. Gosta de hospitalidade e casa cheia.', phone: '(86) 98811-1004', bairro: 'Centro', turnos: 'Tarde, Noite', disc: 'D40 I78 S62 C44', diasAtras: 3 },
  { id: 'cand-carla', vagaId: 'vaga-garcom', nome: 'Carla Souza', status: 'entrevista', experiencia: 'Garçonete há 5 anos em restaurante e bar. Cardápio, sugestão de pratos e ritmo de jantar.', phone: '(86) 98811-1005', bairro: 'Dirceu', turnos: 'Noite', disc: 'D48 I82 S70 C50', diasAtras: 9 },
  { id: 'cand-lucas', vagaId: 'vaga-garcom', nome: 'Lucas Mendes', status: 'banco', experiencia: 'Primeiro emprego em atendimento. Simpático, sem experiência em restaurante.', phone: '(86) 98811-1006', bairro: 'Buenos Aires', turnos: 'Manhã', disc: 'D30 I65 S55 C40', diasAtras: 15 },
  { id: 'cand-fernanda', vagaId: 'vaga-caixa', nome: 'Fernanda Costa', status: 'pendente', experiencia: 'Operadora de caixa em supermercado por 3 anos. PDV, fechamento e fila.', phone: '(86) 98811-1007', bairro: 'Morada do Sol', turnos: 'Manhã, Tarde', disc: 'D45 I60 S68 C75', diasAtras: 5 },
  { id: 'cand-rafael', vagaId: 'vaga-caixa', nome: 'Rafael Dias', status: 'entrevista', experiencia: 'Caixa de restaurante há 2 anos. Conferência de caixa e atendimento no balcão.', phone: '(86) 98811-1008', bairro: 'Dirceu', turnos: 'Tarde, Noite', disc: 'D50 I72 S58 C80', diasAtras: 11 },
  { id: 'cand-beatriz', vagaId: 'vaga-auxiliar', nome: 'Beatriz Rocha', status: 'pendente', experiencia: 'Auxiliar de cozinha e lavagem. Organização, mise en place e apoio no pico.', phone: '(86) 98811-1009', bairro: 'Norte', turnos: 'Manhã, Tarde', disc: 'D42 I40 S75 C60', diasAtras: 4 },
  { id: 'cand-thiago', vagaId: 'vaga-auxiliar', nome: 'Thiago Nunes', status: 'reprovada', experiencia: 'Sem experiência em cozinha. Disponibilidade parcial.', phone: '(86) 98811-1010', bairro: 'Centro', turnos: 'Manhã', disc: 'D28 I33 S40 C35', diasAtras: 18 },
  { id: 'cand-patricia', vagaId: 'vaga-gerente', nome: 'Patrícia Gomes', status: 'entrevista', experiencia: 'Gerente de restaurante há 7 anos. Escala, CMV, equipe de 20 pessoas e operação de almoço/jantar.', phone: '(86) 98811-1011', bairro: 'Mocambinho', turnos: 'Manhã, Tarde, Noite', disc: 'D78 I55 S50 C74', diasAtras: 7 },
  { id: 'cand-eduardo', vagaId: 'vaga-gerente', nome: 'Eduardo Martins', status: 'pendente', experiencia: 'Supervisor de salão há 3 anos. Liderança de turno e indicadores de ticket médio.', phone: '(86) 98811-1012', bairro: 'Dirceu', turnos: 'Tarde, Noite', disc: 'D66 I60 S52 C68', diasAtras: 2 },
]

function buildCandidatos(): Candidato[] {
  return CANDIDATOS_SEED.map((seed) => ({
    id: seed.id,
    vaga_id: seed.vagaId,
    profile_id: null,
    nome: seed.nome,
    experiencia: seed.experiencia,
    info_complementar: [
      `WhatsApp: ${seed.phone}`,
      `Bairro: ${seed.bairro}`,
      `Turnos: ${seed.turnos}`,
      `DISC ${seed.disc}`,
    ].join('\n'),
    referencia: null,
    status: seed.status,
    data_inicio_treinamento: seed.status === 'aprovada' ? daysAgo(-3).slice(0, 10) : null,
    curriculo_url: null,
    curriculo_nome: null,
    criado_em: daysAgo(seed.diasAtras),
  }))
}

function buildMessages(): Message[] {
  return [
    {
      id: 'msg-ana-aprovada',
      candidato_id: 'cand-ana',
      sender_id: 'demo-admin',
      body: 'Olá, Ana! Você foi aprovada para Chapeiro. Seu treinamento começa em breve.',
      created_at: daysAgo(1),
      read_at: null,
    },
  ]
}

/** Gera um store novo com os dados de demonstração (datas relativas a "agora"). */
export function buildDemoStore(): AppStore {
  return {
    units: [...UNITS],
    vagas: buildVagas(),
    candidatos: buildCandidatos(),
    profiles: [],
    experiences: [],
    messages: buildMessages(),
  }
}
