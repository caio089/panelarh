import { rhSessionToken } from './rhAccess'
import { getSupabase } from '@/lib/supabaseClient'

export interface PeopleOpsOverview {
  treinamentos_pendentes: number
  documentos_pendentes: number
  atestados_abertos: number
  sid_abertos: number
}

function client() {
  return getSupabase()
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
