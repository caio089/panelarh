import type { ScheduleDayIndex, ShiftCode, ShiftPreference } from '../types'

/** Cargos disponíveis no cadastro (ordem usada nos agrupamentos da escala). */
export const CARGOS = [
  'Gerente de unidade',
  'Cozinheiro(a)',
  'Chapeiro',
  'Auxiliar de cozinha',
  'Garçom/Garçonete',
  'Atendente de caixa',
  'Bartender',
  'Steward',
] as const

export const GERENTE_CARGO = 'Gerente de unidade'

export const SCHEDULE_DAYS: Array<{ index: ScheduleDayIndex; short: string; long: string }> = [
  { index: 0, short: 'Seg', long: 'Segunda' },
  { index: 1, short: 'Ter', long: 'Terça' },
  { index: 2, short: 'Qua', long: 'Quarta' },
  { index: 3, short: 'Qui', long: 'Quinta' },
  { index: 4, short: 'Sex', long: 'Sexta' },
  { index: 5, short: 'Sáb', long: 'Sábado' },
  { index: 6, short: 'Dom', long: 'Domingo' },
]

export const SHIFT_META: Record<ShiftCode, { label: string; short: string; hours: string; color: string; bg: string }> = {
  manha: { label: 'Manhã', short: 'M', hours: '08:00 – 16:20', color: '#B7791F', bg: '#FDF3DC' },
  tarde: { label: 'Tarde/Noite', short: 'T', hours: '15:00 – 23:20', color: '#24356E', bg: '#E3E8F5' },
  folga: { label: 'Folga', short: 'F', hours: 'Descanso semanal', color: '#2F7D4F', bg: '#E4F3E9' },
}

export const SHIFT_CODES: ShiftCode[] = ['manha', 'tarde', 'folga']

export const SHIFT_PREFERENCE_LABEL: Record<ShiftPreference, string> = {
  manha: 'Manhã',
  tarde: 'Tarde/Noite',
  flexivel: 'Flexível',
}

/** Regras trabalhistas/operacionais usadas pelo gerador e pelo validador. */
export const SCHEDULE_RULES = {
  /** Escala 6x1: um descanso semanal. */
  folgasPorSemana: 1,
  /** Descanso mínimo entre jornadas (CLT art. 66). Tarde → manhã seguinte viola a regra. */
  interjornadaHoras: 11,
} as const

/** Dias de maior movimento (sexta, sábado e domingo). */
export const PEAK_DAYS: ScheduleDayIndex[] = [4, 5, 6]

interface ShiftDemand {
  manha: number
  tarde: number
  /** Reforço no turno da tarde em dias de pico. */
  reforcoPico: number
}

/** Mínimo de pessoas por cargo e turno em um dia comum. */
const DEMAND_BY_ROLE: Record<string, ShiftDemand> = {
  'Cozinheiro(a)': { manha: 1, tarde: 1, reforcoPico: 0 },
  Chapeiro: { manha: 0, tarde: 1, reforcoPico: 0 },
  'Auxiliar de cozinha': { manha: 1, tarde: 1, reforcoPico: 0 },
  'Garçom/Garçonete': { manha: 1, tarde: 1, reforcoPico: 1 },
  'Atendente de caixa': { manha: 0, tarde: 1, reforcoPico: 0 },
  Bartender: { manha: 0, tarde: 1, reforcoPico: 0 },
  Steward: { manha: 1, tarde: 0, reforcoPico: 0 },
}

/** Demanda de um cargo em um dia; cargos sem regra (ex.: gerente) não têm mínimo. */
export function getDemand(cargo: string, day: ScheduleDayIndex): { manha: number; tarde: number } {
  const demand = DEMAND_BY_ROLE[cargo]
  if (!demand) return { manha: 0, tarde: 0 }
  const isPeak = PEAK_DAYS.includes(day)
  return { manha: demand.manha, tarde: demand.tarde + (isPeak ? demand.reforcoPico : 0) }
}

/** Ordena cargos conforme a lista oficial; cargos personalizados vão para o fim. */
export function compareCargo(a: string, b: string): number {
  const ia = CARGOS.indexOf(a as (typeof CARGOS)[number])
  const ib = CARGOS.indexOf(b as (typeof CARGOS)[number])
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
}
