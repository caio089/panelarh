import { adminSessionToken } from '@/lib/adminOverviewDb'
import { getSupabase } from '@/lib/supabaseClient'

export interface AdminUnitPerson {
  id: string
  full_name: string
  job_title: string
  status: 'ativo' | 'inativo'
}

interface AdminUnitPeopleSnapshot {
  unit_name: string
  people: AdminUnitPerson[]
}

export async function loadAdminUnitPeople(unitName: string): Promise<AdminUnitPeopleSnapshot> {
  const client = getSupabase()
  const token = adminSessionToken()
  if (!client) throw new Error('O banco administrativo não está configurado.')
  if (!token) throw new Error('Sua sessão administrativa expirou. Entre novamente.')
  const { data, error } = await client.rpc('admin_unit_people_snapshot', { p_token: token, p_unit_name: unitName })
  if (error) throw new Error(error.message || 'Não foi possível carregar a equipe.')
  return data as AdminUnitPeopleSnapshot
}
