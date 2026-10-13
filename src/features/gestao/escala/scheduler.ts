import { addDays, toISODate } from '../dateUtils'
import type { Colaborador, RegistroPonto, ScheduleAssignments, ScheduleDayIndex, ShiftCode } from '../types'
import { analyzeSchedule, emptyWeek, groupByCargo } from './analysis'
import { getDemand, PEAK_DAYS, SCHEDULE_DAYS } from './rules'

/**
 * Gerador automático de escala semanal ("IA" do painel).
 * Heurística determinística em duas etapas:
 *  1. distribui as folgas (6x1) por cargo, minimizando custo de cobertura;
 *  2. preenche turnos dia a dia respeitando demanda, preferência e interjornada de 11h.
 * O mesmo contrato pode ser servido depois por um otimizador/LLM no backend.
 */

export type NoteTone = 'sucesso' | 'info' | 'alerta'

export interface ScheduleNote {
  id: string
  tone: NoteTone
  title: string
  detail: string
}

export interface GenerateScheduleInput {
  team: Colaborador[]
  /** Dias trabalhados recentemente por colaborador (carga). */
  workload: Map<string, number>
  /** Escala da semana anterior, usada para rodízio de folgas e interjornada de segunda. */
  previous?: ScheduleAssignments
}

export interface GenerateScheduleResult {
  assignments: ScheduleAssignments
  notes: ScheduleNote[]
}

const WORKLOAD_WINDOW_DAYS = 14

/** Dias com batida de ponto nas últimas 2 semanas, por colaborador. */
export function buildRecentWorkload(pontos: RegistroPonto[], today: Date): Map<string, number> {
  const since = toISODate(addDays(today, -WORKLOAD_WINDOW_DAYS))
  const workload = new Map<string, number>()
  for (const p of pontos) {
    if (p.data >= since) workload.set(p.colaboradorId, (workload.get(p.colaboradorId) ?? 0) + 1)
  }
  return workload
}

type FolgaReason = 'preferencia' | 'carga' | 'cobertura'

interface FolgaDecision {
  day: ScheduleDayIndex
  reason: FolgaReason
}

function previousFolgaDay(previous: ScheduleAssignments | undefined, id: string): number {
  return previous?.[id]?.indexOf('folga') ?? -1
}

/** Etapa 1: escolhe o dia de folga de cada pessoa. */
function assignFolgas(input: GenerateScheduleInput): Map<string, FolgaDecision> {
  const decisions = new Map<string, FolgaDecision>()

  for (const [cargo, members] of groupByCargo(input.team)) {
    const offCount = Array.from({ length: 7 }, () => 0)
    const ordered = [...members].sort((a, b) => {
      const prefA = a.folgaPreferida !== null ? 1 : 0
      const prefB = b.folgaPreferida !== null ? 1 : 0
      return prefB - prefA || (input.workload.get(b.id) ?? 0) - (input.workload.get(a.id) ?? 0)
    })
    const heaviestId = [...members].sort(
      (a, b) => (input.workload.get(b.id) ?? 0) - (input.workload.get(a.id) ?? 0),
    )[0]?.id

    for (const person of ordered) {
      const lastFolga = previousFolgaDay(input.previous, person.id)
      let best: { day: ScheduleDayIndex; cost: number } | null = null

      for (const { index: day } of SCHEDULE_DAYS) {
        const demand = getDemand(cargo, day)
        const availableAfter = members.length - offCount[day] - 1
        const shortage = Math.max(0, demand.manha + demand.tarde - availableAfter)
        let cost = (PEAK_DAYS.includes(day) ? 6 : 0) + offCount[day] * 8 + shortage * 20 + day * 0.01
        if (lastFolga === day) cost += 2
        if (person.folgaPreferida === day) cost -= 12
        // Quem mais trabalhou recentemente ganha prioridade no domingo (rodízio dominical),
        // desde que isso não deixe o cargo descoberto no dia de pico.
        if (day === 6 && person.id === heaviestId && lastFolga !== 6 && shortage === 0) cost -= 7
        if (!best || cost < best.cost) best = { day, cost }
      }

      const day = best!.day
      offCount[day] += 1
      const reason: FolgaReason =
        person.folgaPreferida === day
          ? 'preferencia'
          : day === 6 && person.id === heaviestId && lastFolga !== 6
            ? 'carga'
            : 'cobertura'
      decisions.set(person.id, { day, reason })
    }
  }

  return decisions
}

function preferenceRank(person: Colaborador, shift: 'manha' | 'tarde'): number {
  if (person.turnoPreferido === shift) return 0
  if (person.turnoPreferido === 'flexivel') return 1
  return 2
}

/**
 * Etapa 2: define manhã/tarde de cada dia.
 * Quem fechou a casa no dia anterior nunca abre no dia seguinte (interjornada de 11h);
 * se isso deixar a manhã descoberta, a lacuna aparece na validação em vez de violar a lei.
 */
function assignShifts(input: GenerateScheduleInput, folgas: Map<string, FolgaDecision>): ScheduleAssignments {
  const assignments: ScheduleAssignments = {}
  for (const c of input.team) assignments[c.id] = emptyWeek()

  const lastShift = new Map<string, ShiftCode | null>(
    input.team.map((c) => [c.id, input.previous?.[c.id]?.[6] ?? null]),
  )
  const tardeCount = new Map<string, number>(input.team.map((c) => [c.id, 0]))

  for (const { index: day } of SCHEDULE_DAYS) {
    for (const [cargo, members] of groupByCargo(input.team)) {
      const demand = getDemand(cargo, day)
      const working = members.filter((m) => folgas.get(m.id)?.day !== day)
      for (const m of members) if (folgas.get(m.id)?.day === day) assignments[m.id][day] = 'folga'

      const canMorning = (p: Colaborador) => lastShift.get(p.id) !== 'tarde'
      const morningCandidates = working
        .filter(canMorning)
        .sort(
          (a, b) =>
            preferenceRank(a, 'manha') - preferenceRank(b, 'manha') ||
            (tardeCount.get(b.id) ?? 0) - (tardeCount.get(a.id) ?? 0),
        )

      const morning = new Set(morningCandidates.slice(0, demand.manha).map((p) => p.id))
      const rest = working.filter((p) => !morning.has(p.id))
      const afternoonNeed = demand.tarde

      // Prioriza quem prefere tarde para cobrir a demanda da tarde.
      const afternoonOrdered = [...rest].sort(
        (a, b) =>
          preferenceRank(a, 'tarde') - preferenceRank(b, 'tarde') ||
          (tardeCount.get(a.id) ?? 0) - (tardeCount.get(b.id) ?? 0),
      )
      afternoonOrdered.forEach((p, index) => {
        let shift: ShiftCode
        if (index < afternoonNeed) shift = 'tarde'
        else if (canMorning(p) && (p.turnoPreferido === 'manha' || afternoonNeed === 0)) shift = 'manha'
        else if (p.turnoPreferido === 'flexivel' && canMorning(p) && !PEAK_DAYS.includes(day)) shift = 'manha'
        else shift = 'tarde'
        if (shift === 'manha') morning.add(p.id)
        else assignments[p.id][day] = 'tarde'
      })

      for (const id of morning) assignments[id][day] = 'manha'
    }

    for (const c of input.team) {
      const shift = assignments[c.id][day]
      lastShift.set(c.id, shift)
      if (shift === 'tarde') tardeCount.set(c.id, (tardeCount.get(c.id) ?? 0) + 1)
    }
  }

  return assignments
}

function preferenceHitRate(team: Colaborador[], assignments: ScheduleAssignments): number {
  let total = 0
  let hits = 0
  for (const c of team) {
    if (c.turnoPreferido === 'flexivel') continue
    for (const shift of assignments[c.id]) {
      if (shift !== 'manha' && shift !== 'tarde') continue
      total += 1
      if (shift === c.turnoPreferido) hits += 1
    }
  }
  return total ? Math.round((hits / total) * 100) : 100
}

function buildNotes(
  input: GenerateScheduleInput,
  folgas: Map<string, FolgaDecision>,
  assignments: ScheduleAssignments,
): ScheduleNote[] {
  const analysis = analyzeSchedule(input.team, assignments)
  const notes: ScheduleNote[] = [
    {
      id: 'escala-6x1',
      tone: 'sucesso',
      title: `Escala 6x1 montada para ${input.team.length} pessoas`,
      detail: `Cada colaborador tem 1 folga na semana. Cobertura mínima atendida em ${analysis.coverageScore}% dos turnos.`,
    },
    {
      id: 'interjornada',
      tone: 'sucesso',
      title: 'Descanso de 11h entre jornadas respeitado',
      detail: 'Ninguém fecha a casa às 23:20 e abre às 08:00 no dia seguinte.',
    },
    {
      id: 'preferencias',
      tone: 'info',
      title: `Preferência de turno atendida em ${preferenceHitRate(input.team, assignments)}% dos dias`,
      detail: 'Quem prefere manhã ou tarde foi priorizado nesse turno sempre que a cobertura permitiu.',
    },
    {
      id: 'pico',
      tone: 'info',
      title: 'Reforço no salão de sexta a domingo',
      detail: 'Folgas evitadas nos dias de pico e um garçom a mais no turno da tarde.',
    },
  ]

  const sundayByWorkload = input.team.find((c) => folgas.get(c.id)?.reason === 'carga')
  if (sundayByWorkload) {
    notes.push({
      id: 'domingo',
      tone: 'info',
      title: `Folga no domingo para ${sundayByWorkload.nome.split(' ')[0]}`,
      detail: `Maior carga recente do cargo (${input.workload.get(sundayByWorkload.id) ?? 0} dias trabalhados nas últimas 2 semanas) — rodízio dominical.`,
    })
  }

  const preferenceFolgas = [...folgas.values()].filter((f) => f.reason === 'preferencia').length
  if (preferenceFolgas > 0) {
    notes.push({
      id: 'folga-preferida',
      tone: 'info',
      title: `${preferenceFolgas} folga(s) no dia preferido`,
      detail: 'Pedidos de folga cadastrados no perfil do colaborador foram respeitados.',
    })
  }

  const gapsByCargo = new Map<string, number>()
  for (const day of analysis.coverage) {
    for (const gap of day.gaps) gapsByCargo.set(gap.cargo, (gapsByCargo.get(gap.cargo) ?? 0) + gap.missing)
  }
  for (const [cargo, missing] of gapsByCargo) {
    const headcount = input.team.filter((c) => c.cargo === cargo).length
    notes.push({
      id: `gap-${cargo}`,
      tone: 'alerta',
      title: `${cargo}: ${missing} turno(s) descoberto(s)`,
      detail: `Só ${headcount} pessoa(s) no cargo para a demanda da semana. Avalie abrir vaga ou remanejar de outra unidade.`,
    })
  }

  return notes
}

export function generateSchedule(input: GenerateScheduleInput): GenerateScheduleResult {
  const folgas = assignFolgas(input)
  const assignments = assignShifts(input, folgas)
  return { assignments, notes: buildNotes(input, folgas, assignments) }
}
