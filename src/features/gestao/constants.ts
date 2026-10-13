import type { OccurrenceType, PeriodKey, PunctualityStatus } from './types'

export const OCCURRENCE_TYPES: OccurrenceType[] = ['falta', 'advertencia', 'atestado', 'suspensao']

export const OCCURRENCE_META: Record<
  OccurrenceType,
  { label: string; plural: string; short: string; color: string; bg: string }
> = {
  falta: { label: 'Falta', plural: 'Faltas', short: 'Faltas', color: '#E15B3F', bg: '#FBE7E1' },
  advertencia: { label: 'Advertência', plural: 'Advertências', short: 'Advert.', color: '#D08A1E', bg: '#FBF1DC' },
  atestado: { label: 'Atestado', plural: 'Atestados', short: 'Atest.', color: '#3B6EA5', bg: '#E5EEF8' },
  suspensao: { label: 'Suspensão', plural: 'Suspensões', short: 'Susp.', color: '#7A3E8E', bg: '#F1E6F5' },
}

export const PUNCTUALITY_STATUSES: PunctualityStatus[] = ['pontual', 'no_limite', 'atrasado']

export const PUNCTUALITY_META: Record<PunctualityStatus, { label: string; hint: string; color: string; bg: string }> = {
  pontual: { label: 'Pontuais', hint: 'Chegam com folga', color: '#2F7D4F', bg: '#E4F3E9' },
  no_limite: { label: 'Em cima do horário', hint: 'Batem no limite', color: '#D08A1E', bg: '#FBF1DC' },
  atrasado: { label: 'Atrasados', hint: 'Fora da tolerância', color: '#B23B3B', bg: '#FBEAEA' },
}

/**
 * Regras de classificação do ponto (em minutos, relativo ao horário previsto).
 * - pontual: chegou com pelo menos 5 min de antecedência
 * - no limite: entre 4 min antes e a tolerância
 * - atrasado: passou da tolerância
 */
export const PUNCTUALITY_RULES = {
  folgaMinimaMin: 5,
  toleranciaMin: 5,
} as const

export const PERIOD_OPTIONS: Array<{ value: PeriodKey; label: string; days: number }> = [
  { value: '30d', label: '30 dias', days: 30 },
  { value: '90d', label: '90 dias', days: 90 },
  { value: '180d', label: '6 meses', days: 180 },
]

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const WEEKDAY_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Nome exibido da fonte de dados integrada. */
export const DATA_SOURCE_NAME = 'Cyprus'
