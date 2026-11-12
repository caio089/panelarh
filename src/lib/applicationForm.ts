/** Perguntas da candidatura. Campos novos não apagam ficha de quem já se candidatou. */

export const FORM_STEPS = ['Seus dados', 'Sua rotina', 'Seu trabalho', 'Para fechar'] as const

export const FORM_SHIFTS = ['Manhã', 'Tarde', 'Noite', 'Madrugada'] as const

export const WEEKEND_OPTIONS = ['Sim, sábado e domingo', 'Só um dos dias', 'Não consigo'] as const

export const ARRIVAL_OPTIONS = ['Sim, chego no horário', 'Preciso combinar o ponto'] as const

export const RESTAURANT_OPTIONS = ['Sim, já trabalhei', 'Ainda não, seria o primeiro'] as const

export const START_OPTIONS = ['Ainda hoje', 'Esta semana', 'Até 15 dias'] as const

export const HOLIDAY_OPTIONS = ['Sim', 'Só alguns', 'Não consigo'] as const

export const ADULT_OPTIONS = ['Sim, tenho 18 ou mais', 'Ainda não'] as const

export const ROLE_OPTIONS = [
  'Salão e atendimento',
  'Caixa',
  'Cozinha',
  'Forno e pizza',
  'Entrega',
  'Apoio e limpeza',
  'Primeiro emprego',
] as const

export const HOUSE_OPTIONS = ['Já comi na casa', 'Conheço de vista', 'Ainda não'] as const

export const SOURCE_OPTIONS = ['Instagram', 'Indicação de alguém', 'Já sou cliente', 'Outro'] as const

export const RUSH_OPTIONS = ['Me organizo bem', 'Ainda estou pegando o jeito', 'Prefiro um ritmo mais calmo'] as const

export type FormShift = (typeof FORM_SHIFTS)[number]

export interface ApplyDraft {
  step: number
  personal: { full_name: string; cpf: string; phone: string; city: string; age: string }
  job: { preferred_unit: string; weekend: string; commute: string; holidays: string }
  shifts: string[]
  experience: { worked: string; detail: string; daily: string; why: string; start: string; roles: string[] }
  extra: { workCard: string; source: string; restriction: string }
}

const DRAFT_PREFIX = 'panela-apply-draft:'
const LAST_STEP = FORM_STEPS.length - 1

function text(value: unknown) {
  return String(value ?? '').trim()
}

function digits(value: unknown, max: number) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, max)
}

function list(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

function adultFromDraft(value: unknown) {
  const raw = text(value)
  if (ADULT_OPTIONS.includes(raw as (typeof ADULT_OPTIONS)[number])) return raw
  const age = Number(digits(raw, 2))
  if (age >= 18) return ADULT_OPTIONS[0]
  if (age > 0) return ADULT_OPTIONS[1]
  return ''
}

export function applyDraftKey(vagaId: string) {
  return `${DRAFT_PREFIX}${vagaId}`
}

export function emptyApplyDraft(): Omit<ApplyDraft, 'step'> {
  return {
    personal: { full_name: '', cpf: '', phone: '', city: '', age: '' },
    job: { preferred_unit: '', weekend: '', commute: '', holidays: '' },
    shifts: [],
    experience: { worked: '', detail: '', daily: '', why: '', start: '', roles: [] },
    extra: { workCard: '', source: '', restriction: '' },
  }
}

export function loadApplyDraft(vagaId: string): ApplyDraft | null {
  try {
    const raw = sessionStorage.getItem(applyDraftKey(vagaId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ApplyDraft>
    if (!parsed.personal || !parsed.job || !parsed.experience || !Array.isArray(parsed.shifts)) return null
    const blank = emptyApplyDraft()
    return {
      step: Math.min(LAST_STEP, Math.max(0, Number(parsed.step) || 0)),
      personal: {
        ...blank.personal,
        full_name: text(parsed.personal.full_name),
        cpf: digits(parsed.personal.cpf, 11),
        phone: digits(parsed.personal.phone, 11),
        city: text(parsed.personal.city),
        age: adultFromDraft(parsed.personal.age),
      },
      job: {
        ...blank.job,
        preferred_unit: text(parsed.job.preferred_unit),
        weekend: text(parsed.job.weekend),
        commute: text(parsed.job.commute),
        holidays: text(parsed.job.holidays),
      },
      shifts: parsed.shifts.map(String),
      experience: {
        ...blank.experience,
        worked: text(parsed.experience.worked),
        detail: text(parsed.experience.detail),
        daily: text(parsed.experience.daily),
        why: text(parsed.experience.why),
        start: text(parsed.experience.start),
        roles: list(parsed.experience.roles),
      },
      extra: {
        ...blank.extra,
        workCard: text(parsed.extra?.workCard),
        source: text(parsed.extra?.source),
        restriction: text(parsed.extra?.restriction),
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

export function formatCpf(digitsValue: string) {
  const value = digitsCpf(digitsValue)
  if (value.length <= 3) return value
  if (value.length <= 6) return `${value.slice(0, 3)}.${value.slice(3)}`
  if (value.length <= 9) return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`
  return `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`
}

export function formatPhone(digitsValue: string) {
  const value = digitsValue.replace(/\D/g, '').slice(0, 11)
  if (value.length <= 2) return value
  if (value.length <= 7) return `(${value.slice(0, 2)}) ${value.slice(2)}`
  return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`
}

export function isAdultAnswer(value: string) {
  return ADULT_OPTIONS.includes(value as (typeof ADULT_OPTIONS)[number])
}
