import { rhSessionToken } from './rhAccess'
import { getSupabase } from '@/lib/supabaseClient'

export interface RhUnit { id: string; name: string }
export interface RhCollaborator {
  id: string; unit_id: string; unit_name: string; full_name: string; job_title: string
  operational_phone: string | null; status: 'ativo' | 'inativo'; hired_on: string | null; created_at: string
}
export interface CollaboratorDossier {
  id: string
  unit_name: string
  full_name: string
  job_title: string
  status: string
  hired_on: string | null
  operational_phone: string | null
  cpf: string | null
  birth_date: string | null
  birth_place: string | null
  email: string | null
  pix_key: string | null
  address_line: string | null
  neighborhood: string | null
  city_state: string | null
  postal_code: string | null
  ctps_number: string | null
  ctps_series: string | null
  ctps_state: string | null
  esocial_registration: string | null
  contract_type: string | null
  contractual_salary: string | null
  dependents: number | null
  children_count: number | null
  family_allowance: string | null
  company_cnpj: string | null
}
export interface CollaboratorHistoryEvent {
  id: string
  event_type: string
  event_date: string
  title: string
  summary: string
  source_kind?: string
  created_at: string
}

function client() {
  return getSupabase()
}
function token() {
  const value = rhSessionToken()
  if (!value) throw new Error('Sua sessão do RH expirou. Entre novamente.')
  return value
}
function explain(message: string) {
  if (/ambiguous|column reference|42702/i.test(message)) {
    return 'Não foi possível abrir a ficha agora. Tente novamente.'
  }
  return message || 'Não foi possível concluir esta operação.'
}

async function call<T>(name: string, args: Record<string, unknown>) {
  const supabase = client()
  if (!supabase) throw new Error('O banco do RH não está configurado neste ambiente.')
  const { data, error } = await supabase.rpc(name, { p_token: token(), ...args })
  if (error) throw new Error(explain(error.message || ''))
  return data as T
}

export const listRhUnits = () => call<RhUnit[]>('rh_list_units', {})
export const listRhCollaborators = () => call<RhCollaborator[]>('rh_list_collaborators', {})
export const listCollaboratorHistory = (collaboratorId: string) => call<CollaboratorHistoryEvent[]>('rh_list_collaborator_history', { p_collaborator_id: collaboratorId })
export async function loadCollaboratorDossier(collaboratorId: string) {
  const payload = await call<CollaboratorDossier[] | CollaboratorDossier | null>('rh_collaborator_dossier', {
    p_collaborator_id: collaboratorId,
  })
  if (Array.isArray(payload)) return payload[0] ?? null
  return payload
}
export const createRhCollaborator = (input: { unitId: string; fullName: string; jobTitle: string; phone?: string; hiredOn?: string }) => call<string>('rh_create_collaborator', { p_unit_id: input.unitId, p_full_name: input.fullName, p_job_title: input.jobTitle, p_operational_phone: input.phone || null, p_hired_on: input.hiredOn || null })
export const registerRhOccurrence = (input: { collaboratorId: string; kind: string; occurredOn: string; note: string; days: number }) => call<string>('rh_register_occurrence', { p_collaborator_id: input.collaboratorId, p_kind: input.kind, p_occurred_on: input.occurredOn, p_note: input.note, p_days: input.days })
export const registerRhSid = (input: { collaboratorId: string; referenceCode: string; category: string; occurredOn: string; notes: string }) => call<string>('rh_register_sid', { p_collaborator_id: input.collaboratorId, p_reference_code: input.referenceCode, p_category: input.category, p_occurred_on: input.occurredOn, p_notes: input.notes })
export const registerRhDocument = (input: { collaboratorId: string; kind: string; competence?: string; notes: string }) => call<string>('rh_register_document', { p_collaborator_id: input.collaboratorId, p_kind: input.kind, p_competence: input.competence || null, p_notes: input.notes })
export const updateRhHistoryEvent = (input: { eventId: string; eventDate: string; summary: string }) =>
  call<null>('rh_update_collaborator_history', {
    p_event_id: input.eventId,
    p_event_date: input.eventDate,
    p_summary: input.summary,
  })
export const deleteRhHistoryEvent = (eventId: string) =>
  call<null>('rh_delete_collaborator_history', { p_event_id: eventId })
export const clearRhHistory = (collaboratorId: string) =>
  call<number>('rh_clear_collaborator_history', { p_collaborator_id: collaboratorId })
