import { getSupabase } from '@/lib/supabaseClient'
import { rhSessionToken } from '@/lib/rhAccess'
import type { ParsedReport, ReportKind, ReportPerson } from './timeReports'

export interface SavedTimeReport {
  id: string
  unit_id: string
  kind: ReportKind
  period_from: string
  period_to: string
  company_name: string
  source_file: string
  people: ReportPerson[]
  imported_at: string
}
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const client = getSupabase()
  const token = rhSessionToken()
  if (!client) throw new Error('O banco do RH não está configurado.')
  if (!token) throw new Error('Entre na conta de RH para consultar o ponto.')
  const { data, error } = await client.rpc(name, { p_token: token, ...args })
  if (error) throw new Error(error.message)
  return data as T
}
export const listTimeReports = (unitId: string) => call<SavedTimeReport[]>('rh_list_time_reports', { p_unit_id: unitId })
export const saveTimeReport = (unitId: string, fileName: string, report: ParsedReport) =>
  call<string>('rh_save_time_report', {
    p_unit_id: unitId, p_kind: report.kind, p_from: report.from, p_to: report.to,
    p_company: report.company, p_filename: fileName, p_people: report.people,
  })
