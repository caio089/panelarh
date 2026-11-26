import { getSupabase } from '@/lib/supabaseClient'

const ADMIN_SESSION_KEY = 'panela-admin-session'

export interface AdminOverview {
  generated_at: string
  period_from: string
  period_to: string
  active_vacancies: number
  candidates: {
    total: number; new: number; pending: number; pending_over_7_days: number
    interviews: number; approved: number; rejected: number; talent_pool: number
  }
  activity: {
    status_changes: number; interviews_started: number; decisions: number
    occurrences_recorded: number; documents_registered: number
    time_reports_imported: number
  }
  occurrences: { absences: number; warnings: number; medical_notes: number; suspensions: number }
  recent_occurrences: Array<{ id: string; kind: string; occurred_on: string; collaborator_name: string; unit_name: string }>
  units: Array<{
    id: string; name: string; headcount: number; active_vacancies: number
    new_candidates: number; pending: number; interviews: number
    absences: number; warnings: number
  }>
  weekly_candidates: Array<{ week_start: string; count: number }>
}

export function adminSessionToken() {
  return window.localStorage.getItem(ADMIN_SESSION_KEY) || ''
}

export function clearAdminSession() {
  window.localStorage.removeItem(ADMIN_SESSION_KEY)
}

export async function startAdminSession(email: string, password: string) {
  const client = getSupabase()
  if (!client) throw new Error('O banco administrativo não está configurado.')
  const { data, error } = await client.rpc('admin_start_session', {
    p_email: email.trim(), p_password: password,
  })
  if (error) throw new Error(error.message || 'Não foi possível entrar no painel.')
  if (typeof data !== 'string' || data.length !== 64) throw new Error('Não foi possível iniciar a sessão administrativa.')
  window.localStorage.setItem(ADMIN_SESSION_KEY, data)
}

export async function loadAdminOverview(from: string, to: string): Promise<AdminOverview> {
  const client = getSupabase()
  const token = adminSessionToken()
  if (!client) throw new Error('O banco administrativo não está configurado.')
  if (!token) throw new Error('Entre novamente na conta de administrador.')
  const { data, error } = await client.rpc('admin_dashboard_snapshot_range', { p_token: token, p_from: from, p_to: to })
  if (error) throw new Error(error.message || 'Não foi possível carregar o painel.')
  return data as AdminOverview
}
