import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { rhSessionToken } from './rhAccess'

export interface PeopleOpsOverview {
  treinamentos_pendentes: number
  documentos_pendentes: number
  atestados_abertos: number
  sid_abertos: number
}

let database: SupabaseClient | null | undefined

function client() {
  if (database !== undefined) return database
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  database = url && key ? createClient(url, key) : null
  return database
}

export async function loadPeopleOpsOverview(): Promise<PeopleOpsOverview | null> {
  const supabase = client()
  const token = rhSessionToken()
  if (!supabase || !token) return null
  const { data, error } = await supabase.rpc('rh_people_ops_overview', { p_token: token })
  if (error || !data || typeof data !== 'object') return null
  const value = data as Partial<PeopleOpsOverview>
  return {
    treinamentos_pendentes: Number(value.treinamentos_pendentes) || 0,
    documentos_pendentes: Number(value.documentos_pendentes) || 0,
    atestados_abertos: Number(value.atestados_abertos) || 0,
    sid_abertos: Number(value.sid_abertos) || 0,
  }
}
