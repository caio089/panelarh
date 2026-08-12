import type {
  CandidateStatus,
  Candidato,
  Experience,
  Message,
  Profile,
  Unit,
  Vaga,
} from '@/types'

export const UNIT_CENTRO = 'unit-centro'
export const UNIT_SUDESTE = 'unit-sudeste'
export const UNIT_NORTE = 'unit-norte'

/** @deprecated use UNIT_SUDESTE */
export const UNIT_SHOPPING = UNIT_SUDESTE

export const MOCK_UNITS: Unit[] = [
  { id: UNIT_CENTRO, name: 'Unidade Centro' },
  { id: UNIT_SUDESTE, name: 'Unidade Sudeste' },
  { id: UNIT_NORTE, name: 'Unidade Norte' },
]

export const MOCK_VAGAS: Vaga[] = [
  {
    id: 'vaga-chapeiro',
    unit_id: UNIT_CENTRO,
    titulo: 'Chapeiro',
    descricao:
      'Responsável pela produção na chapa, padronização de montagem e qualidade dos pratos quentes. Experiência em alto volume é diferencial.',
    localidade: 'Centro · SP',
    tipo: 'Presencial',
    ativa: true,
    criada_em: '2026-07-28T10:00:00.000Z',
  },
  {
    id: 'vaga-garcom',
    unit_id: UNIT_CENTRO,
    titulo: 'Garçom / Atendente',
    descricao:
      'Atendimento ao salão, hospitalidade e ritmo de casa cheia. Buscamos pessoas com boa comunicação e postura.',
    localidade: 'Centro · SP',
    tipo: 'Presencial',
    ativa: true,
    criada_em: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'vaga-gerente',
    unit_id: UNIT_SUDESTE,
    titulo: 'Gerente de Loja',
    descricao:
      'Liderança da operação, gestão de equipe, indicadores e experiência do cliente na Unidade Sudeste.',
    localidade: 'Sudeste · SP',
    tipo: 'Presencial',
    ativa: true,
    criada_em: '2026-07-20T10:00:00.000Z',
  },
  {
    id: 'vaga-auxiliar',
    unit_id: UNIT_SUDESTE,
    titulo: 'Auxiliar de Cozinha',
    descricao:
      'Apoio à produção, mise en place, organização e limpeza. Ideal para quem quer crescer na carreira gastronômica.',
    localidade: 'Sudeste · SP',
    tipo: 'Presencial',
    ativa: true,
    criada_em: '2026-08-05T10:00:00.000Z',
  },
  {
    id: 'vaga-caixa',
    unit_id: UNIT_NORTE,
    titulo: 'Operador de Caixa',
    descricao:
      'Atendimento no caixa, conferência de pedidos e experiência acolhedora no balcão.',
    localidade: 'Zona Norte · SP',
    tipo: 'Presencial',
    ativa: true,
    criada_em: '2026-08-08T10:00:00.000Z',
  },
  {
    id: 'vaga-cozinheiro',
    unit_id: UNIT_NORTE,
    titulo: 'Cozinheiro',
    descricao:
      'Produção de pratos do cardápio, controle de qualidade e apoio à liderança da cozinha.',
    localidade: 'Zona Norte · SP',
    tipo: 'Presencial',
    ativa: false,
    criada_em: '2026-06-15T10:00:00.000Z',
  },
]

const baseProfile = (partial: Partial<Profile> & Pick<Profile, 'id' | 'full_name' | 'email'>): Profile => ({
  role: 'candidate',
  unit_id: null,
  phone: null,
  cpf: null,
  city: null,
  birth_date: null,
  desired_role: null,
  availability: null,
  salary_expectation: null,
  linkedin: null,
  disc_d: null,
  disc_i: null,
  disc_s: null,
  disc_c: null,
  onboarding_completed: true,
  ...partial,
})

export const MOCK_PROFILES: Profile[] = [
  baseProfile({
    id: 'cand-ana',
    full_name: 'Ana Beatriz Souza',
    email: 'ana.souza@email.com',
    phone: '(11) 98888-1010',
    city: 'São Paulo',
    desired_role: 'Chapeiro',
    availability: 'Integral · noites',
    disc_d: 78,
    disc_i: 42,
    disc_s: 55,
    disc_c: 61,
  }),
  baseProfile({
    id: 'cand-bruno',
    full_name: 'Bruno Henrique Lima',
    email: 'bruno.lima@email.com',
    phone: '(11) 97777-2020',
    city: 'Guarulhos',
    desired_role: 'Garçom',
    availability: 'Finais de semana',
    disc_d: 45,
    disc_i: 82,
    disc_s: 68,
    disc_c: 40,
  }),
  baseProfile({
    id: 'cand-carla',
    full_name: 'Carla Mendes',
    email: 'carla.mendes@email.com',
    phone: '(11) 96666-3030',
    city: 'São Paulo',
    desired_role: 'Gerente de Loja',
    availability: 'Integral',
    disc_d: 71,
    disc_i: 66,
    disc_s: 58,
    disc_c: 74,
  }),
  baseProfile({
    id: 'cand-diego',
    full_name: 'Diego Alves',
    email: 'diego.alves@email.com',
    phone: '(11) 95555-4040',
    city: 'Osasco',
    desired_role: 'Auxiliar de Cozinha',
    availability: 'Manhãs',
    disc_d: 38,
    disc_i: 51,
    disc_s: 84,
    disc_c: 63,
  }),
  baseProfile({
    id: 'cand-elena',
    full_name: 'Elena Rocha',
    email: 'elena.rocha@email.com',
    phone: '(11) 94444-5050',
    city: 'São Paulo',
    desired_role: 'Operador de Caixa',
    availability: 'Tarde/noite',
    disc_d: 52,
    disc_i: 70,
    disc_s: 60,
    disc_c: 57,
  }),
  baseProfile({
    id: 'cand-felipe',
    full_name: 'Felipe Castro',
    email: 'felipe.castro@email.com',
    phone: '(11) 93333-6060',
    city: 'São Bernardo',
    desired_role: 'Chapeiro',
    availability: 'Integral',
    disc_d: 66,
    disc_i: 48,
    disc_s: 72,
    disc_c: 69,
  }),
  baseProfile({
    id: 'cand-gabi',
    full_name: 'Gabriela Nunes',
    email: 'gabi.nunes@email.com',
    phone: '(11) 92222-7070',
    city: 'São Paulo',
    desired_role: 'Garçom',
    availability: 'Noites',
    disc_d: 41,
    disc_i: 88,
    disc_s: 64,
    disc_c: 45,
  }),
  baseProfile({
    id: 'cand-hugo',
    full_name: 'Hugo Martins',
    email: 'hugo.martins@email.com',
    phone: '(11) 91111-8080',
    city: 'Santo André',
    desired_role: 'Cozinheiro',
    availability: 'Integral',
    disc_d: 59,
    disc_i: 44,
    disc_s: 70,
    disc_c: 81,
  }),
]

export const MOCK_EXPERIENCES: Experience[] = [
  {
    id: 'exp-1',
    profile_id: 'cand-ana',
    company: 'Burger House',
    role_title: 'Chapeiro',
    start_date: '01/2023',
    end_date: '06/2025',
    description: 'Produção de lanches em pico, padrão de montagem e controle de tempo.',
  },
  {
    id: 'exp-2',
    profile_id: 'cand-bruno',
    company: 'Cantina Bella',
    role_title: 'Garçom',
    start_date: '03/2022',
    end_date: 'Atual',
    description: 'Salão 80 lugares, upselling e fechamento de caixa auxiliar.',
  },
  {
    id: 'exp-3',
    profile_id: 'cand-carla',
    company: 'Rede Sabor & Cia',
    role_title: 'Subgerente',
    start_date: '2019',
    end_date: '2025',
    description: 'Gestão de 18 colaboradores, escala, estoque e NPS da unidade.',
  },
  {
    id: 'exp-4',
    profile_id: 'cand-diego',
    company: 'Padaria Central',
    role_title: 'Auxiliar',
    start_date: '2024',
    end_date: 'Atual',
    description: 'Mise en place, organização de câmaras e apoio ao forno.',
  },
]

function cand(
  partial: Omit<Candidato, 'info_complementar' | 'experiencia' | 'referencia' | 'curriculo_url' | 'curriculo_nome' | 'data_inicio_treinamento'> &
    Partial<Candidato>,
): Candidato {
  return {
    info_complementar: null,
    experiencia: null,
    referencia: null,
    curriculo_url: null,
    curriculo_nome: null,
    data_inicio_treinamento: null,
    ...partial,
  }
}

export const MOCK_CANDIDATOS: Candidato[] = [
  cand({
    id: 'c-1',
    vaga_id: 'vaga-chapeiro',
    profile_id: 'cand-ana',
    nome: 'Ana Beatriz Souza',
    status: 'entrevista',
    criado_em: '2026-08-02T14:00:00.000Z',
    info_complementar: 'Disponível para começar em 15 dias.',
  }),
  cand({
    id: 'c-2',
    vaga_id: 'vaga-chapeiro',
    profile_id: 'cand-felipe',
    nome: 'Felipe Castro',
    status: 'pendente',
    criado_em: '2026-08-09T11:00:00.000Z',
  }),
  cand({
    id: 'c-3',
    vaga_id: 'vaga-chapeiro',
    profile_id: null,
    nome: 'Ricardo Pinto',
    status: 'banco',
    criado_em: '2026-07-30T09:00:00.000Z',
    experiencia: '5 anos em fast food',
    referencia: 'Indicação do líder João',
  }),
  cand({
    id: 'c-4',
    vaga_id: 'vaga-garcom',
    profile_id: 'cand-bruno',
    nome: 'Bruno Henrique Lima',
    status: 'aprovada',
    data_inicio_treinamento: '2026-08-20',
    criado_em: '2026-08-03T16:00:00.000Z',
  }),
  cand({
    id: 'c-5',
    vaga_id: 'vaga-garcom',
    profile_id: 'cand-gabi',
    nome: 'Gabriela Nunes',
    status: 'entrevista',
    criado_em: '2026-08-07T10:00:00.000Z',
  }),
  cand({
    id: 'c-6',
    vaga_id: 'vaga-gerente',
    profile_id: 'cand-carla',
    nome: 'Carla Mendes',
    status: 'entrevista',
    criado_em: '2026-08-01T12:00:00.000Z',
  }),
  cand({
    id: 'c-7',
    vaga_id: 'vaga-auxiliar',
    profile_id: 'cand-diego',
    nome: 'Diego Alves',
    status: 'pendente',
    criado_em: '2026-08-10T08:30:00.000Z',
  }),
  cand({
    id: 'c-8',
    vaga_id: 'vaga-caixa',
    profile_id: 'cand-elena',
    nome: 'Elena Rocha',
    status: 'pendente',
    criado_em: '2026-08-11T15:00:00.000Z',
  }),
  cand({
    id: 'c-9',
    vaga_id: 'vaga-caixa',
    profile_id: null,
    nome: 'Marcos Vieira',
    status: 'reprovada',
    criado_em: '2026-08-04T13:00:00.000Z',
    info_complementar: 'Sem disponibilidade de horário.',
  }),
  cand({
    id: 'c-10',
    vaga_id: 'vaga-cozinheiro',
    profile_id: 'cand-hugo',
    nome: 'Hugo Martins',
    status: 'banco',
    criado_em: '2026-07-18T10:00:00.000Z',
  }),
  cand({
    id: 'c-11',
    vaga_id: 'vaga-gerente',
    profile_id: null,
    nome: 'Patrícia Gomes',
    status: 'pendente',
    criado_em: '2026-08-06T17:00:00.000Z',
    experiencia: 'Gestão de restaurante 3 anos',
  }),
  cand({
    id: 'c-12',
    vaga_id: 'vaga-auxiliar',
    profile_id: null,
    nome: 'Tiago Ferreira',
    status: 'entrevista',
    criado_em: '2026-08-08T09:00:00.000Z',
  }),
]

export const MOCK_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    candidato_id: 'c-1',
    sender_id: 'mock-admin',
    body: 'Olá Ana! Você avançou para a etapa de Entrevista na vaga de Chapeiro. Podemos agendar amanhã às 15h?',
    created_at: '2026-08-08T18:00:00.000Z',
    read_at: null,
  },
  {
    id: 'msg-2',
    candidato_id: 'c-4',
    sender_id: 'mock-admin',
    body: 'Parabéns, Bruno! Você foi aprovado. Treinamento inicia em 20/08 na Unidade Centro.',
    created_at: '2026-08-09T12:00:00.000Z',
    read_at: '2026-08-09T14:00:00.000Z',
  },
  {
    id: 'msg-3',
    candidato_id: 'c-6',
    sender_id: 'mock-admin',
    body: 'Carla, sua entrevista com o time de operações está confirmada para sexta-feira.',
    created_at: '2026-08-10T09:30:00.000Z',
    read_at: null,
  },
]

export interface MockStore {
  units: Unit[]
  vagas: Vaga[]
  candidatos: Candidato[]
  profiles: Profile[]
  experiences: Experience[]
  messages: Message[]
}

export function createInitialStore(): MockStore {
  return {
    units: structuredClone(MOCK_UNITS),
    vagas: structuredClone(MOCK_VAGAS),
    candidatos: structuredClone(MOCK_CANDIDATOS),
    profiles: structuredClone(MOCK_PROFILES),
    experiences: structuredClone(MOCK_EXPERIENCES),
    messages: structuredClone(MOCK_MESSAGES),
  }
}

export function countByStatus(list: Candidato[]) {
  const c: Record<CandidateStatus, number> = {
    pendente: 0,
    entrevista: 0,
    aprovada: 0,
    reprovada: 0,
    banco: 0,
  }
  list.forEach((item) => {
    if (item.status in c) c[item.status] += 1
  })
  return c
}
