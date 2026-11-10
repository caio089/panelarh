import { createClient } from '@supabase/supabase-js'
import { saiposUnit } from './saiposUnits.js'

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  return { url: url.trim(), key: key.trim() }
}

function bearerToken(header) {
  const value = typeof header === 'string' ? header.trim() : ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : ''
}

function relatedUnitName(units) {
  if (Array.isArray(units)) return String(units[0]?.name || '').trim()
  return String(units?.name || '').trim()
}

function unitIdFromName(name) {
  const normalized = String(name || '').trim().toLocaleLowerCase('pt-BR')
  return ['dirceu', 'promorar', 'mocambinho'].find((id) => saiposUnit(id)?.name.toLocaleLowerCase('pt-BR') === normalized) || ''
}

/** Autoriza no servidor. A rota solicitada nunca é usada como prova de pertencimento. */
export async function authorizeTvUnit(req, requestedUnitId) {
  const requestedUnit = saiposUnit(requestedUnitId)
  if (!requestedUnit) return { status: 404, error: 'Unidade não encontrada.' }

  const token = bearerToken(req?.headers?.authorization)
  if (!token) return { status: 401, error: 'Entre com a conta da unidade para ver os pedidos.' }

  const { url, key } = supabaseConfig()
  if (!url || !key) return { status: 503, error: 'A autenticação da TV não está configurada no servidor.' }

  const supabase = createClient(url, key, {
    accessToken: async () => token,
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return { status: 401, error: 'Sua sessão expirou. Entre novamente.' }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, unit_id, units(name)')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (profileError || !profile) return { status: 403, error: 'Seu perfil não tem acesso à operação da TV.' }

  const role = String(profile.role || '')
  if (role === 'admin') return { unit: requestedUnit, userId: userData.user.id, role }
  if (!['gerente', 'lider', 'colaborador'].includes(role)) {
    return { status: 403, error: 'Seu perfil não tem acesso aos pedidos da unidade.' }
  }

  const profileUnitId = unitIdFromName(relatedUnitName(profile.units))
  if (!profile.unit_id || profileUnitId !== requestedUnitId) {
    return { status: 403, error: 'Esta conta pertence a outra unidade.' }
  }
  return { unit: requestedUnit, userId: userData.user.id, role }
}
