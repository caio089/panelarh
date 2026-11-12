/** Perguntas curtas da candidatura. Sem anexo e sem teste de perfil. */

export const FORM_SHIFTS = ['Manhã', 'Tarde', 'Noite', 'Madrugada'] as const

export const WEEKEND_OPTIONS = ['Sim', 'Não', 'Só um dos dias'] as const

export const COMMUTE_OPTIONS = ['A pé', 'Ônibus', 'Moto ou carro', 'Carona'] as const

export const RESTAURANT_OPTIONS = ['Sim', 'Ainda não'] as const

export const START_OPTIONS = ['Hoje', 'Esta semana', 'Este mês'] as const

export type FormShift = (typeof FORM_SHIFTS)[number]

export interface ApplyDraft {
  step: number
  personal: { full_name: string; cpf: string; phone: string; city: string }
  job: { preferred_unit: string; weekend: string; commute: string }
  shifts: string[]
  experience: { worked: string; detail: string; daily: string; why: string; start: string }
}

const DRAFT_PREFIX = 'panela-apply-draft:'

export function applyDraftKey(vagaId: string) {
  return `${DRAFT_PREFIX}${vagaId}`
}

export function loadApplyDraft(vagaId: string): ApplyDraft | null {
  try {
    const raw = sessionStorage.getItem(applyDraftKey(vagaId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ApplyDraft>
    if (!parsed.personal || !parsed.job || !parsed.experience || !Array.isArray(parsed.shifts)) return null
    return {
      step: Math.min(2, Math.max(0, Number(parsed.step) || 0)),
      personal: {
        full_name: String(parsed.personal.full_name || ''),
        cpf: String(parsed.personal.cpf || '').replace(/\D/g, '').slice(0, 11),
        phone: String(parsed.personal.phone || '').replace(/\D/g, '').slice(0, 11),
        city: String(parsed.personal.city || ''),
      },
      job: {
        preferred_unit: String(parsed.job.preferred_unit || ''),
        weekend: String(parsed.job.weekend || ''),
        commute: String(parsed.job.commute || ''),
      },
      shifts: parsed.shifts.map(String),
      experience: {
        worked: String(parsed.experience.worked || ''),
        detail: String(parsed.experience.detail || ''),
        daily: String(parsed.experience.daily || ''),
        why: String(parsed.experience.why || ''),
        start: String(parsed.experience.start || ''),
      },
    }
  } catch {
    return null
  }
}

export function saveApplyDraft(vagaId: string, draft: ApplyDraft) {
  sessionStorage.setItem(applyDraftKey(vagaId), JSON.stringify(draft))
}

export function clearApplyDraft(vagaId: string) {
  sessionStorage.removeItem(applyDraftKey(vagaId))
}

export function digitsCpf(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function isCompleteCpf(value: string) {
  return digitsCpf(value).length === 11
}

export function cpfFromInfo(info: string | null | undefined) {
  if (!info) return ''
  const match = info.match(/CPF:\s*([0-9.\-\s]{11,18})/i)
  return match ? digitsCpf(match[1]) : ''
}

export function formatCpf(digits: string) {
  const value = digitsCpf(digits)
  if (value.length <= 3) return value
  if (value.length <= 6) return `${value.slice(0, 3)}.${value.slice(3)}`
  if (value.length <= 9) return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`
  return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`
}

export function formatPhone(digits: string) {
  const value = digits.replace(/\D/g, '').slice(0, 11)
  if (value.length <= 2) return value
  if (value.length <= 7) return `(${value.slice(0, 2)}) ${value.slice(2)}`
  return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`
}
