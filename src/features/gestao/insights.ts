import { OCCURRENCE_META } from './constants'
import {
  emptyOccurrenceCounts,
  percentChange,
  totalOccurrences,
  type CollaboratorStats,
  type UnitSummary,
} from './metrics'
import type { OccurrenceCounts } from './types'

/**
 * Motor de resumo do painel.
 * Hoje gera os textos a partir de regras sobre as métricas; o contrato (`AiSummary`)
 * já está pronto para ser alimentado por um LLM no backend quando a integração existir.
 */

export type InsightTone = 'atencao' | 'melhorar' | 'destaque'

export interface AiInsight {
  id: string
  tone: InsightTone
  title: string
  detail: string
  unitId?: string
}

export interface AiSummary {
  headline: string
  paragraph: string
  atencao: AiInsight[]
  melhorar: AiInsight[]
  destaques: AiInsight[]
}

interface InsightInput {
  units: UnitSummary[]
  collaborators: CollaboratorStats[]
  weekdayLateness: number[]
  periodDays: number
  /** Quando informado, o texto é escrito no contexto de uma unidade. */
  scopeLabel?: string
}

const MAX_PER_GROUP = 3

function sumCounts(list: OccurrenceCounts[]): OccurrenceCounts {
  return list.reduce((acc, c) => {
    acc.falta += c.falta
    acc.advertencia += c.advertencia
    acc.atestado += c.atestado
    acc.suspensao += c.suspensao
    return acc
  }, emptyOccurrenceCounts())
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function describeChange(change: number | null) {
  if (change === null) return 'sem base de comparação'
  if (change === 0) return 'estável em relação ao período anterior'
  return `${change > 0 ? '+' : ''}${change}% vs. período anterior`
}

function buildAttentionInsights({ units, collaborators }: InsightInput): AiInsight[] {
  const insights: AiInsight[] = []

  const risingUnit = [...units]
    .map((u) => ({ u, change: percentChange(u.occurrences.falta, u.previousOccurrences.falta) }))
    .filter((x) => x.change !== null && x.change >= 15 && x.u.occurrences.falta >= 3)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0]
  if (risingUnit) {
    insights.push({
      id: `rising-${risingUnit.u.unitId}`,
      tone: 'atencao',
      title: `Faltas subindo em ${risingUnit.u.unitName}`,
      detail: `${plural(risingUnit.u.occurrences.falta, 'falta', 'faltas')} no período (+${risingUnit.change}%). Vale uma conversa com ${risingUnit.u.gerente?.nome.split(' ')[0] ?? 'a gerência'}.`,
      unitId: risingUnit.u.unitId,
    })
  }

  const critical = collaborators
    .filter((c) => c.riskLevel === 'critico')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 2)
  for (const c of critical) {
    const unitName = units.find((u) => u.unitId === c.colaborador.unitId)?.unitName ?? ''
    insights.push({
      id: `critical-${c.colaborador.id}`,
      tone: 'atencao',
      title: `${c.colaborador.nome} em situação crítica`,
      detail: `${plural(c.occurrences.falta, 'falta', 'faltas')} e ${plural(c.occurrences.advertencia, 'advertência', 'advertências')} · ${c.colaborador.cargo}${unitName ? ` · ${unitName}` : ''}.`,
      unitId: c.colaborador.unitId,
    })
  }

  const suspensions = sumCounts(units.map((u) => u.occurrences)).suspensao
  if (suspensions > 0 && insights.length < MAX_PER_GROUP) {
    insights.push({
      id: 'suspensions',
      tone: 'atencao',
      title: `${plural(suspensions, 'suspensão aplicada', 'suspensões aplicadas')}`,
      detail: 'Suspensões indicam reincidência. Confira se o histórico de advertências está documentado.',
    })
  }

  return insights.slice(0, MAX_PER_GROUP)
}

function buildImprovementInsights({ collaborators }: InsightInput): AiInsight[] {
  const insights: AiInsight[] = []

  const repeatedSickNotes = collaborators.filter((c) => c.occurrences.atestado >= 3).length
  if (repeatedSickNotes > 0) {
    insights.push({
      id: 'sick-notes',
      tone: 'melhorar',
      title: `${plural(repeatedSickNotes, 'colaborador', 'colaboradores')} com 3+ atestados`,
      detail: 'Avaliar ergonomia, carga de trabalho e acompanhamento de saúde ocupacional.',
    })
  }

  return insights.slice(0, MAX_PER_GROUP)
}

function buildHighlightInsights({ units, collaborators }: InsightInput): AiInsight[] {
  const insights: AiInsight[] = []

  const bestUnit = [...units].sort((a, b) => b.healthScore - a.healthScore)[0]
  if (bestUnit && units.length > 1) {
    insights.push({
      id: `best-${bestUnit.unitId}`,
      tone: 'destaque',
      title: `${bestUnit.unitName} é a unidade mais estável`,
      detail: `Saúde ${bestUnit.healthScore}/100 no período.`,
      unitId: bestUnit.unitId,
    })
  }

  const mostPressuredUnitId =
    units.length > 1 ? [...units].sort((a, b) => a.healthScore - b.healthScore)[0].unitId : null
  const improvingUnit = [...units]
    .filter((u) => u.unitId !== mostPressuredUnitId)
    .map((u) => ({ u, change: percentChange(totalOccurrences(u.occurrences), totalOccurrences(u.previousOccurrences)) }))
    .filter((x) => x.change !== null && x.change <= -10)
    .sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0]
  if (improvingUnit) {
    insights.push({
      id: `improving-${improvingUnit.u.unitId}`,
      tone: 'destaque',
      title: `${improvingUnit.u.unitName} reduziu ocorrências`,
      detail: `${Math.abs(improvingUnit.change ?? 0)}% menos ocorrências que no período anterior. Bom trabalho da gestão local.`,
      unitId: improvingUnit.u.unitId,
    })
  }

  const exemplary = collaborators.filter((c) => totalOccurrences(c.occurrences) === 0).length
  if (exemplary > 0) {
    insights.push({
      id: 'exemplary',
      tone: 'destaque',
      title: `${plural(exemplary, 'colaborador exemplar', 'colaboradores exemplares')}`,
      detail: 'Zero ocorrências no período. Ótimos candidatos a reconhecimento.',
    })
  }

  return insights.slice(0, MAX_PER_GROUP)
}

function buildParagraph({ units, periodDays, scopeLabel }: InsightInput): { headline: string; paragraph: string } {
  const current = sumCounts(units.map((u) => u.occurrences))
  const previous = sumCounts(units.map((u) => u.previousOccurrences))
  const change = percentChange(totalOccurrences(current), totalOccurrences(previous))
  const scope = scopeLabel ? `em ${scopeLabel}` : 'na rede'

  const parts = (['falta', 'advertencia', 'atestado', 'suspensao'] as const).map((t) =>
    plural(current[t], OCCURRENCE_META[t].label.toLowerCase(), OCCURRENCE_META[t].plural.toLowerCase()),
  )
  const partsText = `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`

  const headline =
    change === null || change === 0
      ? `Operação estável ${scope}`
      : change > 0
        ? `Ocorrências subiram ${change}% ${scope}`
        : `Ocorrências caíram ${Math.abs(change)}% ${scope}`

  const worstUnit = units.length > 1 ? [...units].sort((a, b) => a.healthScore - b.healthScore)[0] : null
  const unitSentence = worstUnit
    ? ` ${worstUnit.unitName} concentra a maior pressão operacional (saúde ${worstUnit.healthScore}/100).`
    : ''

  const paragraph = `Nos últimos ${periodDays} dias foram registradas ${partsText} ${scope} (${describeChange(change)}).${unitSentence}`

  return { headline, paragraph }
}

export function generateAiSummary(input: InsightInput): AiSummary {
  return {
    ...buildParagraph(input),
    atencao: buildAttentionInsights(input),
    melhorar: buildImprovementInsights(input),
    destaques: buildHighlightInsights(input),
  }
}
