import type { Profile, UserRole } from '@/types'
import { UNIT_CENTRO } from '@/lib/mockData'

const STORAGE_KEY = 'panela_rh_mock_auth'

export const MOCK_AUTH_ENABLED = true

export interface MockUser {
  id: string
  email: string
}

export interface MockSession {
  user: MockUser
  profile: Profile
}

/** Contas prontas para demo */
export const MOCK_ACCOUNTS: Array<{
  label: string
  description: string
  email: string
  password: string
  profile: Profile
}> = [
  {
    label: 'Administrador',
    description: 'Vê e gerencia todas as unidades',
    email: 'admin@panela.local',
    password: 'admin',
    profile: {
      id: 'mock-admin',
      email: 'admin@panela.local',
      full_name: 'Admin Panela',
      role: 'admin',
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
    },
  },
  {
    label: 'Líder de unidade',
    description: 'Gerencia só a própria unidade',
    email: 'lider@panela.local',
    password: 'lider',
    profile: {
      id: 'mock-lider',
      email: 'lider@panela.local',
      full_name: 'Líder Unidade',
      role: 'lider',
      unit_id: UNIT_CENTRO,
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
    },
  },
  {
    label: 'Candidato',
    description: 'Vê vagas e se candidata',
    email: 'candidato@panela.local',
    password: 'candidato',
    profile: {
      id: 'mock-candidato',
      email: 'candidato@panela.local',
      full_name: 'Candidato Demo',
      role: 'candidate',
      unit_id: null,
      phone: '(11) 99999-0000',
      cpf: null,
      city: 'São Paulo',
      birth_date: null,
      desired_role: 'Chapeiro',
      availability: 'Integral',
      salary_expectation: null,
      linkedin: null,
      disc_d: 62,
      disc_i: 48,
      disc_s: 71,
      disc_c: 55,
      onboarding_completed: true,
    },
  },
]

export function loadMockSession(): MockSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MockSession
  } catch {
    return null
  }
}

export function saveMockSession(session: MockSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearMockSession() {
  localStorage.removeItem(STORAGE_KEY)
}

export function createMockCandidate(email: string, fullName: string): MockSession {
  const id = `mock-cand-${crypto.randomUUID()}`
  const profile: Profile = {
    id,
    email,
    full_name: fullName || email.split('@')[0],
    role: 'candidate' as UserRole,
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
    onboarding_completed: false,
  }
  return { user: { id, email }, profile }
}

export function findPresetAccount(email: string, password: string) {
  return MOCK_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password,
  )
}
