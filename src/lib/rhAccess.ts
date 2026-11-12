import { getSupabase } from '@/lib/supabaseClient'

const RH_SESSION_KEY = 'panela-rh-session'

function client() {
  return getSupabase()
}

function readable(error: { message?: string } | null, fallback: string) {
  const text = error?.message || ''
  if (text.includes('senha atual')) return 'A senha atual não confere.'
  if (text.includes('e-mail válido')) return 'Informe um e-mail válido.'
  if (text.includes('administração')) return 'Esse e-mail é da administração.'
  if (text.includes('6 caracteres')) return 'A nova senha precisa ter pelo menos 6 caracteres.'
  return fallback
}

/** true = senha certa, false = senha errada, null = banco indisponível. */
export async function startRhSession(email: string, password: string): Promise<string | null> {
  const supabase = client()
  if (!supabase) return null
  const { data, error } = await supabase.rpc('rh_start_session', {
    p_email: email.trim(),
    p_password: password,
  })
  if (error) return null
  if (typeof data !== 'string' || data.length !== 64) return null
  window.localStorage.setItem(RH_SESSION_KEY, data)
  return data
}

export function rhSessionToken() {
  return window.localStorage.getItem(RH_SESSION_KEY) || ''
}

export function clearRhSession() {
  window.localStorage.removeItem(RH_SESSION_KEY)
}

export async function changeRhAccess(currentPassword: string, email: string, password: string) {
  const supabase = client()
  if (!supabase) throw new Error('O banco de acesso não está configurado neste ambiente.')
  const { error } = await supabase.rpc('rh_change_access', {
    p_current: currentPassword,
    p_email: email.trim(),
    p_password: password,
  })
  if (error) throw new Error(readable(error, 'Não foi possível atualizar o acesso.'))
}
