import { useMemo } from 'react'
import { useData } from '@/contexts/DataContext'
import { startOfToday } from './dateUtils'
import { generateAiSummary } from './insights'
import {
  buildCollaboratorStats,
  buildMonthlySeries,
  buildUnitSummaries,
  buildWeekdayLateness,
  buildWeeklySparkline,
  countOccurrences,
  countPunctuality,
  filterByRange,
  getPeriodRanges,
} from './metrics'
import { getMockGestaoDataset } from './mockData'
import { OCCURRENCE_TYPES } from './constants'
import { useGestaoStore } from './GestaoStoreContext'
import type { OccurrenceType, PeriodKey } from './types'

/**
 * Ponto único de acesso aos dados do painel de gestão.
 * Quando a integração com o Cyprus existir, basta trocar `getMockGestaoDataset`
 * por uma busca na API (ex.: React Query) mantendo o retorno deste hook.
 *
 * @param unitId Opcional: restringe todas as métricas a uma unidade.
 */
export function useGestao(period: PeriodKey, unitId?: string) {
  const { store } = useData()
  const { colaboradores } = useGestaoStore()

  return useMemo(() => {
    const today = startOfToday()
    const generated = getMockGestaoDataset()
    // Colaboradores vêm do cadastro editável; histórico de quem foi excluído é descartado.
    const team = colaboradores.filter((c) => !unitId || c.unitId === unitId)
    const teamIds = new Set(team.map((c) => c.id))
    const dataset = {
      ...generated,
      colaboradores: team,
      ocorrencias: generated.ocorrencias.filter((o) => teamIds.has(o.colaboradorId)),
      pontos: generated.pontos.filter((p) => teamIds.has(p.colaboradorId)),
    }

    const units = store.units.filter((u) => !unitId || u.id === unitId)
    const ranges = getPeriodRanges(period, today)
    const currentOcs = filterByRange(dataset.ocorrencias, ranges.current)
    const currentPontos = filterByRange(dataset.pontos, ranges.current)

    const collaborators = buildCollaboratorStats(dataset, ranges.current)
    const unitSummaries = buildUnitSummaries(dataset, units, ranges, collaborators)
    const weekdayLateness = buildWeekdayLateness(currentPontos)

    const sparklines = Object.fromEntries(
      OCCURRENCE_TYPES.map((t) => [t, buildWeeklySparkline(dataset.ocorrencias, t, today)]),
    ) as Record<OccurrenceType, number[]>

    const peopleAffected = Object.fromEntries(
      OCCURRENCE_TYPES.map((t) => [t, collaborators.filter((c) => c.occurrences[t] > 0).length]),
    ) as Record<OccurrenceType, number>

    const summary = generateAiSummary({
      units: unitSummaries,
      collaborators,
      weekdayLateness,
      periodDays: ranges.days,
      scopeLabel: unitId ? units[0]?.name : undefined,
    })

    return {
      dataset,
      ranges,
      units: unitSummaries,
      collaborators,
      occurrences: countOccurrences(currentOcs),
      previousOccurrences: countOccurrences(filterByRange(dataset.ocorrencias, ranges.previous)),
      recentOccurrences: [...currentOcs].sort((a, b) => b.data.localeCompare(a.data)),
      punctuality: countPunctuality(currentPontos),
      monthlySeries: buildMonthlySeries(dataset.ocorrencias, today),
      weekdayLateness,
      sparklines,
      peopleAffected,
      summary,
    }
  }, [period, unitId, store.units, colaboradores])
}

export type GestaoView = ReturnType<typeof useGestao>
