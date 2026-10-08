import type { Profile } from '@/types'

/** Credenciais fixas do modo demonstração (sem backend; não usar em produção real). */
export const DEMO_ADMIN_EMAIL = 'admin@panelavelha.com'
export const DEMO_ADMIN_PASSWORD = 'admin123'

const SESSION_KEY = 'panela-demo-session'

export interface DemoUser {
  id: string
  email: string
}

export const DEMO_ADMIN_USER: DemoUser = { id: 'demo-admin', email: DEMO_ADMIN_EMAIL }

export const DEMO_ADMIN_PROFILE: Profile = {
  id: DEMO_ADMIN_USER.id,
  email: DEMO_ADMIN_EMAIL,
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
}

export function isValidDemoLogin(email: string, password: string) {
  return email.trim().toLowerCase() === DEMO_ADMIN_EMAIL && password === DEMO_ADMIN_PASSWORD
}

export function hasDemoSession() {
  return window.localStorage.getItem(SESSION_KEY) === DEMO_ADMIN_USER.id
}

export function startDemoSession() {
  window.localStorage.setItem(SESSION_KEY, DEMO_ADMIN_USER.id)
}

export function endDemoSession() {
  window.localStorage.removeItem(SESSION_KEY)
}
