import type { Colaborador, ScheduleAssignments, ScheduleDayIndex, ShiftCode } from '../types'
import { compareCargo, getDemand, SCHEDULE_DAYS, SHIFT_META } from './rules'

/**
 * Análise de uma escala (manual ou gerada): cobertura por dia/turno/cargo
 * e problemas trabalhistas/operacionais. Função pura, reaproveitável no backend.
 */

export type IssueSeverity = 'erro' | 'alerta' | 'info'

export interface ScheduleIssue {
  id: string
  severity: IssueSeverity
  message: string
  colaboradorId?: string
  day?: ScheduleDayIndex
}

export interface CoverageGap {
  cargo: string
  shift: Exclude<ShiftCode, 'folga'>
  missing: number
}

export interface DayCoverage {
  day: ScheduleDayIndex
  manha: number
  tarde: number
  folga: number
  required: number
  covered: number
  gaps: CoverageGap[]
}

export interface PersonSummary {
  worked: number
  folgas: number
  undefinedDays: number
}

export interface ScheduleAnalysis {
  coverage: DayCoverage[]
  issues: ScheduleIssue[]
  people: Record<string, PersonSummary>
  /** 0–100: proporção da demanda mínima atendida na semana. */
  coverageScore: number
  isComplete: boolean
}

export function emptyWeek(): Array<ShiftCode | null> {
  return Array.from({ length: 7 }, () => null)
}

export function groupByCargo(team: Colaborador[]): Array<[string, Colaborador[]]> {
  const map = new Map<string, Colaborador[]>()
  for (const c of team) {
    const list = map.get(c.cargo)
    if (list) list.push(c)
    else map.set(c.cargo, [c])
  }
  return [...map.entries()]
    .sort(([a], [b]) => compareCargo(a, b))
    .map(([cargo, list]) => [cargo, list.sort((a, b) => a.nome.localeCompare(b.nome))])
}

function summarizePeople(team: Colaborador[], assignments: ScheduleAssignments) {
  const people: Record<string, PersonSummary> = {}
  for (const c of team) {
    const week = assignments[c.id] ?? emptyWeek()
    people[c.id] = {
      worked: week.filter((s) => s === 'manha' || s === 'tarde').length,
      folgas: week.filter((s) => s === 'folga').length,
      undefinedDays: week.filter((s) => s === null).length,
    }
  }
  return people
}

function computeCoverage(team: Colaborador[], assignments: ScheduleAssignments): DayCoverage[] {
  const groups = groupByCargo(team)
  return SCHEDULE_DAYS.map(({ index: day }) => {
    const totals = { manha: 0, tarde: 0, folga: 0 }
    let required = 0
    let covered = 0
    const gaps: CoverageGap[] = []

    for (const [cargo, members] of groups) {
      const demand = getDemand(cargo, day)
      const counts = { manha: 0, tarde: 0 }
      for (const m of members) {
        const shift = assignments[m.id]?.[day]
        if (shift === 'manha' || shift === 'tarde') counts[shift] += 1
        if (shift) totals[shift] += 1
      }
      for (const shift of ['manha', 'tarde'] as const) {
        required += demand[shift]
        covered += Math.min(demand[shift], counts[shift])
        if (counts[shift] < demand[shift]) gaps.push({ cargo, shift, missing: demand[shift] - counts[shift] })
      }
    }

    return { day, ...totals, required, covered, gaps }
  })
}

function collectIssues(
  team: Colaborador[],
  assignments: ScheduleAssignments,
  people: Record<string, PersonSummary>,
  coverage: DayCoverage[],
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = []

  for (const c of team) {
    const summary = people[c.id]
    const firstName = c.nome.split(' ')[0]
    if (summary.undefinedDays === 0 && summary.folgas === 0) {
      issues.push({
        id: `sem-folga-${c.id}`,
        severity: 'erro',
        colaboradorId: c.id,
        message: `${c.nome} está sem folga na semana (escala 6x1 exige 1 descanso).`,
      })
    }
    if (summary.folgas > 1) {
      issues.push({
        id: `folga-extra-${c.id}`,
        severity: 'info',
        colaboradorId: c.id,
        message: `${firstName} tem ${summary.folgas} folgas — confirme se é banco de horas ou férias.`,
      })
    }

    const week = assignments[c.id] ?? emptyWeek()
    for (let d = 0; d < 6; d += 1) {
      if (week[d] === 'tarde' && week[d + 1] === 'manha') {
        issues.push({
          id: `interjornada-${c.id}-${d}`,
          severity: 'erro',
          colaboradorId: c.id,
          day: (d + 1) as ScheduleDayIndex,
          message: `${firstName}: sai às 23:20 de ${SCHEDULE_DAYS[d].short.toLowerCase()} e entra às 08:00 de ${SCHEDULE_DAYS[d + 1].short.toLowerCase()} — menos de 11h de descanso.`,
        })
      }
    }
  }

  for (const day of coverage) {
    for (const gap of day.gaps) {
      issues.push({
        id: `gap-${day.day}-${gap.cargo}-${gap.shift}`,
        severity: 'alerta',
        day: day.day,
        message: `${SCHEDULE_DAYS[day.day].long}: falta${gap.missing > 1 ? 'm' : ''} ${gap.missing} ${gap.cargo} no turno ${SHIFT_META[gap.shift].label.toLowerCase()}.`,
      })
    }
  }

  const undefinedCount = Object.values(people).reduce((sum, p) => sum + p.undefinedDays, 0)
  if (undefinedCount > 0) {
    issues.push({
      id: 'nao-definido',
      severity: 'info',
      message: `${undefinedCount} turno${undefinedCount > 1 ? 's' : ''} ainda sem definição.`,
    })
  }

  const order: Record<IssueSeverity, number> = { erro: 0, alerta: 1, info: 2 }
  return issues.sort((a, b) => order[a.severity] - order[b.severity])
}

export function analyzeSchedule(team: Colaborador[], assignments: ScheduleAssignments): ScheduleAnalysis {
  const people = summarizePeople(team, assignments)
  const coverage = computeCoverage(team, assignments)
  const required = coverage.reduce((sum, d) => sum + d.required, 0)
  const covered = coverage.reduce((sum, d) => sum + d.covered, 0)

  return {
    coverage,
    people,
    issues: collectIssues(team, assignments, people, coverage),
    coverageScore: required ? Math.round((covered / required) * 100) : 100,
    isComplete: Object.values(people).every((p) => p.undefinedDays === 0),
  }
}
