import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { rhSessionToken } from './rhAccess'

export interface RhUnit { id: string; name: string }
export interface RhCollaborator {
  id: string; unit_id: string; unit_name: string; full_name: string; job_title: string
  operational_phone: string | null; status: 'ativo' | 'inativo'; hired_on: string | null; created_at: string
}
export interface CollaboratorHistoryEvent {
  id: string; event_type: string; event_date: string; title: string; summary: string; created_at: string
}

let database: SupabaseClient | null | undefined
function client() {
  if (database !== undefined) return database
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  database = url && key ? createClient(url, key) : null
  return database
}
function token() {
  const value = rhSessionToken()
  if (!value) throw new Error('Sua sessão do RH expirou. Entre novamente.')
  return value
}
async function call<T>(name: string, args: Record<string, unknown>) {
  const supabase = client()
  if (!supabase) throw new Error('O banco do RH não está configurado neste ambiente.')
  const { data, error } = await supabase.rpc(name, { p_token: token(), ...args })
  if (error) throw new Error(error.message || 'Não foi possível concluir esta operação.')
  return data as T
}

export const listRhUnits = () => call<RhUnit[]>('rh_list_units', {})
export const listRhCollaborators = () => call<RhCollaborator[]>('rh_list_collaborators', {})
export const listCollaboratorHistory = (collaboratorId: string) => call<CollaboratorHistoryEvent[]>('rh_list_collaborator_history', { p_collaborator_id: collaboratorId })
export const createRhCollaborator = (input: { unitId: string; fullName: string; jobTitle: string; phone?: string; hiredOn?: string }) => call<string>('rh_create_collaborator', { p_unit_id: input.unitId, p_full_name: input.fullName, p_job_title: input.jobTitle, p_operational_phone: input.phone || null, p_hired_on: input.hiredOn || null })
export const registerRhOccurrence = (input: { collaboratorId: string; kind: string; occurredOn: string; note: string; days: number }) => call<string>('rh_register_occurrence', { p_collaborator_id: input.collaboratorId, p_kind: input.kind, p_occurred_on: input.occurredOn, p_note: input.note, p_days: input.days })
export const registerRhSid = (input: { collaboratorId: string; referenceCode: string; category: string; occurredOn: string; notes: string }) => call<string>('rh_register_sid', { p_collaborator_id: input.collaboratorId, p_reference_code: input.referenceCode, p_category: input.category, p_occurred_on: input.occurredOn, p_notes: input.notes })
export const registerRhDocument = (input: { collaboratorId: string; kind: string; competence?: string; notes: string }) => call<string>('rh_register_document', { p_collaborator_id: input.collaboratorId, p_kind: input.kind, p_competence: input.competence || null, p_notes: input.notes })
