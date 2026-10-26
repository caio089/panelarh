import type { Profile } from '@/types'

/** Credenciais fixas do modo demonstração (sem backend; não usar em produção real). */
export const DEMO_ADMIN_EMAIL = 'admin@panelavelha.com'
export const DEMO_ADMIN_PASSWORD = 'admin123'
export const DEMO_RH_EMAIL = 'rh@panelavelha.com'
export const DEMO_RH_PASSWORD = 'rh123'

const SESSION_KEY = 'panela-demo-session'
const STAFF_COOKIE = 'panela-staff'
const RH_EMAIL_KEY = 'panela-rh-email'

export interface DemoUser {
  id: string
  email: string
}

export interface DemoAccount {
  password: string
  user: DemoUser
  profile: Profile
}

function emptyProfile(id: string, email: string, name: string, role: Profile['role']): Profile {
  return {
    id,
    email,
    full_name: name,
    role,
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
}

export const DEMO_ADMIN_USER: DemoUser = { id: 'demo-admin', email: DEMO_ADMIN_EMAIL }
export const DEMO_ADMIN_PROFILE: Profile = emptyProfile(DEMO_ADMIN_USER.id, DEMO_ADMIN_EMAIL, 'Admin Panela', 'admin')

const DEMO_RH_USER: DemoUser = { id: 'demo-rh', email: DEMO_RH_EMAIL }

const ACCOUNTS: DemoAccount[] = [
  { password: DEMO_ADMIN_PASSWORD, user: DEMO_ADMIN_USER, profile: DEMO_ADMIN_PROFILE },
  {
    password: DEMO_RH_PASSWORD,
    user: DEMO_RH_USER,
    profile: emptyProfile(DEMO_RH_USER.id, DEMO_RH_EMAIL, 'RH Panela Velha', 'rh'),
  },
]

export function findDemoAccount(email: string, password: string) {
  const normalized = email.trim().toLowerCase()
  return ACCOUNTS.find((account) => account.user.email === normalized && account.password === password) ?? null
}

export function demoAccountById(id: string | null) {
  if (!id) return null
  return ACCOUNTS.find((account) => account.user.id === id) ?? null
}

export function currentDemoSessionId() {
  const id = window.localStorage.getItem(SESSION_KEY)
  return demoAccountById(id) ? id : null
}

function writeStaffCookie(userId: string | null) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  if (!userId) {
    document.cookie = `${STAFF_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
    return
  }
  document.cookie = `${STAFF_COOKIE}=${encodeURIComponent(userId)}; Path=/; SameSite=Lax${secure}`
}

export function startDemoSession(userId: string) {
  window.localStorage.setItem(SESSION_KEY, userId)
  writeStaffCookie(userId)
}

export function endDemoSession() {
  window.localStorage.removeItem(SESSION_KEY)
  writeStaffCookie(null)
}

/** Garante o cookie da sessão já gravada, antes de qualquer consulta interna. */
export function syncStaffCookie(userId: string | null) {
  writeStaffCookie(userId)
}

export function rememberedRhEmail() {
  return window.localStorage.getItem(RH_EMAIL_KEY)?.trim().toLowerCase() || DEMO_RH_EMAIL
}

export function rememberRhEmail(email: string) {
  window.localStorage.setItem(RH_EMAIL_KEY, email.trim().toLowerCase())
}
