/**
 * Modelo de dados do painel de gestão (donos).
 * Espelha o formato esperado da integração com o sistema de ponto/RH (Cyprus),
 * para que a troca do mock pela API real não altere as telas.
 */

export type OccurrenceType = 'falta' | 'advertencia' | 'atestado' | 'suspensao'

export type PunctualityStatus = 'pontual' | 'no_limite' | 'atrasado'

export type PeriodKey = '30d' | '90d' | '180d'

export type CollaboratorStatus = 'ativo' | 'inativo'

/** Turnos da escala. */
export type ShiftCode = 'manha' | 'tarde' | 'folga'

export type ShiftPreference = 'manha' | 'tarde' | 'flexivel'

/** Índice do dia na semana da escala: 0 = segunda … 6 = domingo. */
export type ScheduleDayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Colaborador {
  id: string
  nome: string
  cargo: string
  unitId: string
  admissao: string
  /** Horário contratual de entrada, formato HH:mm. */
  entradaPrevista: string
  isGerente: boolean
  status: CollaboratorStatus
  telefone: string
  turnoPreferido: ShiftPreference
  /** Dia de folga preferido (0 = segunda … 6 = domingo) ou null se indiferente. */
  folgaPreferida: ScheduleDayIndex | null
}

/** Turno de cada colaborador em cada dia da semana (null = ainda não definido). */
export type ScheduleAssignments = Record<string, Array<ShiftCode | null>>

export interface EscalaSemana {
  unitId: string
  /** Segunda-feira da semana (yyyy-mm-dd). */
  weekStart: string
  assignments: ScheduleAssignments
  origem: 'manual' | 'ia'
  atualizadaEm: string
}

export interface Ocorrencia {
  id: string
  colaboradorId: string
  unitId: string
  tipo: OccurrenceType
  /** Data ISO (yyyy-mm-dd). */
  data: string
  motivo: string
  /** Quantidade de dias (atestado/suspensão). */
  dias: number
}

export interface RegistroPonto {
  colaboradorId: string
  unitId: string
  data: string
  entradaPrevista: string
  /** Diferença em minutos entre a batida real e a prevista (negativo = chegou antes). */
  diferencaMin: number
}

export interface GestaoDataset {
  colaboradores: Colaborador[]
  ocorrencias: Ocorrencia[]
  pontos: RegistroPonto[]
  /** Momento da última sincronização com a fonte de dados. */
  sincronizadoEm: string
}

export type OccurrenceCounts = Record<OccurrenceType, number>

export type PunctualityCounts = Record<PunctualityStatus, number>
