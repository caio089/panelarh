import {
  MONTH_SHORT,
  OCCURRENCE_TYPES,
  PERIOD_OPTIONS,
  PUNCTUALITY_RULES,
  PUNCTUALITY_STATUSES,
} from './constants'
import { addDays, parseISODate, toISODate } from './dateUtils'
import type {
  Colaborador,
  GestaoDataset,
  Ocorrencia,
  OccurrenceCounts,
  PeriodKey,
  PunctualityCounts,
  PunctualityStatus,
  RegistroPonto,
} from './types'

/**
 * Funções puras de agregação. Não dependem de React,
 * então podem ser reaproveitadas no backend ou em testes.
 */

export interface DateRange {
  start: string
  end: string
}

export interface PeriodRanges {
  current: DateRange
  previous: DateRange
  days: number
}

export type RiskLevel = 'ok' | 'atencao' | 'critico'

export interface CollaboratorStats {
  colaborador: Colaborador
  occurrences: OccurrenceCounts
  punctuality: PunctualityCounts
  punctualityRate: number
  averageDelayMin: number
  riskScore: number
  riskLevel: RiskLevel
  lastOccurrence: Ocorrencia | null
}

export interface UnitSummary {
  unitId: string
  unitName: string
  gerente: Colaborador | null
  headcount: number
  occurrences: OccurrenceCounts
  previousOccurrences: OccurrenceCounts
  punctuality: PunctualityCounts
  punctualityRate: number
  healthScore: number
  collaboratorsAtRisk: number
}

/** Pesos usados para o score de risco do colaborador. */
const RISK_WEIGHTS: Record<keyof OccurrenceCounts, number> = {
  falta: 3,
  advertencia: 4,
  atestado: 1,
  suspensao: 8,
}
const LATE_ARRIVAL_WEIGHT = 0.6

export function emptyOccurrenceCounts(): OccurrenceCounts {
  return { falta: 0, advertencia: 0, atestado: 0, suspensao: 0 }
}

export function emptyPunctualityCounts(): PunctualityCounts {
  return { pontual: 0, no_limite: 0, atrasado: 0 }
}

export function getPeriodRanges(period: PeriodKey, today: Date): PeriodRanges {
  const days = PERIOD_OPTIONS.find((p) => p.value === period)?.days ?? 30
  const end = addDays(today, -1)
  const start = addDays(today, -days)
  return {
    days,
    current: { start: toISODate(start), end: toISODate(end) },
    previous: { start: toISODate(addDays(start, -days)), end: toISODate(addDays(start, -1)) },
  }
}

export function isInRange(isoDate: string, range: DateRange): boolean {
  return isoDate >= range.start && isoDate <= range.end
}

export function filterByRange<T extends { data: string }>(items: T[], range: DateRange): T[] {
  return items.filter((item) => isInRange(item.data, range))
}

export function countOccurrences(ocorrencias: Ocorrencia[]): OccurrenceCounts {
  const counts = emptyOccurrenceCounts()
  for (const oc of ocorrencias) counts[oc.tipo] += 1
  return counts
}

export function totalOccurrences(counts: OccurrenceCounts): number {
  return OCCURRENCE_TYPES.reduce((sum, type) => sum + counts[type], 0)
}

export function classifyPunctuality(diferencaMin: number): PunctualityStatus {
  if (diferencaMin <= -PUNCTUALITY_RULES.folgaMinimaMin) return 'pontual'
  if (diferencaMin <= PUNCTUALITY_RULES.toleranciaMin) return 'no_limite'
  return 'atrasado'
}

export function countPunctuality(pontos: RegistroPonto[]): PunctualityCounts {
  const counts = emptyPunctualityCounts()
  for (const p of pontos) counts[classifyPunctuality(p.diferencaMin)] += 1
  return counts
}

export function punctualityTotal(counts: PunctualityCounts): number {
  return PUNCTUALITY_STATUSES.reduce((sum, s) => sum + counts[s], 0)
}

/** Percentual (0–100) de batidas de uma categoria. */
export function punctualityShare(counts: PunctualityCounts, status: PunctualityStatus): number {
  const total = punctualityTotal(counts)
  return total ? Math.round((counts[status] / total) * 100) : 0
}

/** Variação percentual entre dois valores; null quando não há base de comparação. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 16) return 'critico'
  if (score >= 8) return 'atencao'
  return 'ok'
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const bucket = map.get(k)
    if (bucket) bucket.push(item)
    else map.set(k, [item])
  }
  return map
}

export function buildCollaboratorStats(dataset: GestaoDataset, range: DateRange): CollaboratorStats[] {
  const occByColab = groupBy(filterByRange(dataset.ocorrencias, range), (o) => o.colaboradorId)
  const pontoByColab = groupBy(filterByRange(dataset.pontos, range), (p) => p.colaboradorId)

  return dataset.colaboradores.map((colaborador) => {
    const ocs = occByColab.get(colaborador.id) ?? []
    const pts = pontoByColab.get(colaborador.id) ?? []
    const occurrences = countOccurrences(ocs)
    const punctuality = countPunctuality(pts)
    const lateEntries = pts.filter((p) => p.diferencaMin > 0)
    const averageDelayMin = lateEntries.length
      ? Math.round(lateEntries.reduce((sum, p) => sum + p.diferencaMin, 0) / lateEntries.length)
      : 0
    const riskScore = Math.round(
      OCCURRENCE_TYPES.reduce((sum, t) => sum + occurrences[t] * RISK_WEIGHTS[t], 0) +
        punctuality.atrasado * LATE_ARRIVAL_WEIGHT,
    )
    const lastOccurrence = ocs.length
      ? ocs.reduce((latest, oc) => (oc.data > latest.data ? oc : latest))
      : null

    return {
      colaborador,
      occurrences,
      punctuality,
      punctualityRate: punctualityShare(punctuality, 'pontual'),
      averageDelayMin,
      riskScore,
      riskLevel: riskLevelFromScore(riskScore),
      lastOccurrence,
    }
  })
}

/** Score de saúde da unidade (0–100): pondera ocorrências por colaborador e pontualidade. */
function computeHealthScore(occurrences: OccurrenceCounts, headcount: number, punctuality: PunctualityCounts) {
  if (!headcount) return 100
  const weighted = OCCURRENCE_TYPES.reduce((sum, t) => sum + occurrences[t] * RISK_WEIGHTS[t], 0)
  const perCapita = weighted / headcount
  const onTimeShare = 1 - punctualityShare(punctuality, 'atrasado') / 100
  const score = 100 - perCapita * 7 - (1 - onTimeShare) * 120
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function buildUnitSummaries(
  dataset: GestaoDataset,
  units: Array<{ id: string; name: string }>,
  ranges: PeriodRanges,
  collaboratorStats: CollaboratorStats[],
): UnitSummary[] {
  return units.map((unit) => {
    const team = dataset.colaboradores.filter((c) => c.unitId === unit.id && c.status === 'ativo')
    const unitOcs = dataset.ocorrencias.filter((o) => o.unitId === unit.id)
    const occurrences = countOccurrences(filterByRange(unitOcs, ranges.current))
    const previousOccurrences = countOccurrences(filterByRange(unitOcs, ranges.previous))
    const punctuality = countPunctuality(
      filterByRange(
        dataset.pontos.filter((p) => p.unitId === unit.id),
        ranges.current,
      ),
    )

    return {
      unitId: unit.id,
      unitName: unit.name,
      gerente: team.find((c) => c.isGerente) ?? null,
      headcount: team.length,
      occurrences,
      previousOccurrences,
      punctuality,
      punctualityRate: punctualityShare(punctuality, 'pontual'),
      healthScore: computeHealthScore(occurrences, team.length, punctuality),
      collaboratorsAtRisk: collaboratorStats.filter(
        (s) => s.colaborador.unitId === unit.id && s.riskLevel !== 'ok',
      ).length,
    }
  })
}

export interface MonthlyBucket {
  label: string
  counts: OccurrenceCounts
}

/** Série mensal de ocorrências (últimos N meses, incluindo o atual). */
export function buildMonthlySeries(ocorrencias: Ocorrencia[], today: Date, months = 6): MonthlyBucket[] {
  const buckets: MonthlyBucket[] = []
  const indexByKey = new Map<string, number>()

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    indexByKey.set(key, buckets.length)
    buckets.push({ label: MONTH_SHORT[date.getMonth()], counts: emptyOccurrenceCounts() })
  }

  for (const oc of ocorrencias) {
    const date = parseISODate(oc.data)
    const index = indexByKey.get(`${date.getFullYear()}-${date.getMonth()}`)
    if (index !== undefined) buckets[index].counts[oc.tipo] += 1
  }

  return buckets
}

/** Série semanal de um tipo de ocorrência, usada nos sparklines dos KPIs. */
export function buildWeeklySparkline(
  ocorrencias: Ocorrencia[],
  tipo: Ocorrencia['tipo'],
  today: Date,
  weeks = 12,
): number[] {
  const series = Array.from({ length: weeks }, () => 0)
  const start = addDays(today, -weeks * 7)
  const startIso = toISODate(start)
  for (const oc of ocorrencias) {
    if (oc.tipo !== tipo || oc.data < startIso) continue
    const diffDays = Math.floor((parseISODate(oc.data).getTime() - start.getTime()) / 86_400_000)
    const index = Math.min(weeks - 1, Math.floor(diffDays / 7))
    if (index >= 0) series[index] += 1
  }
  return series
}

/** Percentual de atrasos por dia da semana (0 = domingo). */
export function buildWeekdayLateness(pontos: RegistroPonto[]): number[] {
  const totals = Array.from({ length: 7 }, () => 0)
  const late = Array.from({ length: 7 }, () => 0)
  for (const p of pontos) {
    const weekday = parseISODate(p.data).getDay()
    totals[weekday] += 1
    if (classifyPunctuality(p.diferencaMin) === 'atrasado') late[weekday] += 1
  }
  return totals.map((total, i) => (total ? Math.round((late[i] / total) * 100) : 0))
}
