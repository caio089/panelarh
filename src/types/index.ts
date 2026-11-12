export type UserRole = 'candidate' | 'admin' | 'lider' | 'rh'

export type CandidateStatus =
  | 'pendente'
  | 'entrevista'
  | 'aprovada'
  | 'reprovada'
  | 'banco'

export interface Unit {
  id: string
  name: string
}

export interface Vaga {
  id: string
  unit_id: string
  titulo: string
  descricao: string | null
  localidade: string | null
  tipo: string | null
  ativa: boolean | null
  criada_em: string
  salario?: string | null
  horario?: string | null
  regime?: string | null
  responsabilidades?: string | null
  requisitos?: string | null
  diferenciais?: string | null
  beneficios?: string | null
  unit?: Unit
  candidatos?: Candidato[]
}

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: UserRole
  unit_id: string | null
  phone: string | null
  cpf: string | null
  city: string | null
  birth_date: string | null
  desired_role: string | null
  availability: string | null
  salary_expectation: string | null
  linkedin: string | null
  disc_d: number | null
  disc_i: number | null
  disc_s: number | null
  disc_c: number | null
  onboarding_completed: boolean | null
  about_me?: string | null
  weekend_availability?: string | null
  shifts?: string | null
  preferred_unit?: string | null
  relevant_experience?: string | null
  why_company?: string | null
  has_transport?: string | null
}

export interface Experience {
  id: string
  profile_id: string
  company: string
  role_title: string
  start_date: string | null
  end_date: string | null
  description: string | null
}

export interface Candidato {
  id: string
  vaga_id: string
  profile_id: string | null
  nome: string
  cpf: string | null
  info_complementar: string | null
  experiencia: string | null
  referencia: string | null
  status: CandidateStatus
  data_inicio_treinamento: string | null
  curriculo_url: string | null
  curriculo_nome: string | null
  criado_em: string
  profile?: Profile
}

export interface Message {
  id: string
  candidato_id: string
  sender_id: string | null
  body: string
  created_at: string
  read_at: string | null
}

export const STATUS_META: Record<
  CandidateStatus,
  { label: string; color: string; bg: string }
> = {
  pendente: { label: 'Em análise', color: '#8A93A6', bg: '#EEF0F4' },
  entrevista: { label: 'Entrevista', color: '#3B6EA5', bg: '#E8F1FA' },
  aprovada: { label: 'Aprovada', color: '#2F7D4F', bg: '#E4F3E9' },
  reprovada: { label: 'Reprovada', color: '#B23B3B', bg: '#FBEAEA' },
  banco: { label: 'Banco de talentos', color: '#A6791F', bg: '#FBF1DC' },
}

export const PIPELINE_ORDER: CandidateStatus[] = [
  'pendente',
  'entrevista',
  'aprovada',
  'banco',
  'reprovada',
]
