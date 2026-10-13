import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { Alert, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useGestaoStore } from '@/features/gestao/GestaoStoreContext'
import { startOfToday } from '@/features/gestao/dateUtils'
import { getMockGestaoDataset } from '@/features/gestao/mockData'
import { analyzeSchedule, emptyWeek } from '@/features/gestao/escala/analysis'
import { SHIFT_CODES, SHIFT_META } from '@/features/gestao/escala/rules'
import { buildRecentWorkload, generateSchedule, type ScheduleNote } from '@/features/gestao/escala/scheduler'
import { useWeekParam } from '@/features/gestao/escala/useWeekParam'
import { formatWeekRange, getWeekStart, shiftWeek } from '@/features/gestao/escala/week'
import type { Colaborador, EscalaSemana, ScheduleAssignments, ScheduleDayIndex, ShiftCode } from '@/features/gestao/types'
import { SectionCard } from '@/features/gestao/components/atoms'
import { ConfirmDialog } from '@/features/gestao/components/ConfirmDialog'
import { ScheduleGrid } from '@/features/gestao/components/escala/ScheduleGrid'
import { ScheduleAiNotes, ScheduleIssues } from '@/features/gestao/components/escala/ScheduleInsights'
import { useUnitContext } from './unitContext'

const AI_STEPS = [
  'Lendo cargos, preferências e pedidos de folga…',
  'Calculando a carga das últimas 2 semanas…',
  'Distribuindo folgas 6x1 e reforço nos dias de pico…',
  'Validando descanso de 11h e cobertura mínima…',
]
const AI_STEP_MS = 420
const FEEDBACK_DURATION_MS = 3500

/** Escala da semana da unidade (manual ou gerada pela IA). */
export function UnitScheduleTab() {
  const { unitId } = useUnitContext()
  const [weekStart, setWeekStart] = useWeekParam()
  // Remonta o editor ao trocar de unidade/semana para carregar a escala correta.
  return <ScheduleEditor key={`${unitId}-${weekStart}`} unitId={unitId} weekStart={weekStart} onWeekChange={setWeekStart} />
}

function ensureRows(assignments: ScheduleAssignments, team: Colaborador[]): ScheduleAssignments {
  const rows: ScheduleAssignments = {}
  for (const c of team) rows[c.id] = assignments[c.id] ? [...assignments[c.id]] : emptyWeek()
  return rows
}

function ScheduleEditor({
  unitId,
  weekStart,
  onWeekChange,
}: {
  unitId: string
  weekStart: string
  onWeekChange: (week: string) => void
}) {
  const { colaboradores, getEscala, saveEscala } = useGestaoStore()
  const team = useMemo(
    () => colaboradores.filter((c) => c.unitId === unitId && c.status === 'ativo'),
    [colaboradores, unitId],
  )
  const saved = getEscala(unitId, weekStart)
  const previousWeek = getEscala(unitId, shiftWeek(weekStart, -1))

  const [draft, setDraft] = useState<ScheduleAssignments>(() => ensureRows(saved?.assignments ?? {}, team))
  const [origem, setOrigem] = useState<EscalaSemana['origem']>(saved?.origem ?? 'manual')
  const [dirty, setDirty] = useState(false)
  const [notes, setNotes] = useState<ScheduleNote[] | null>(null)
  const [aiStep, setAiStep] = useState<number | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [feedback, setFeedback] = useState('')
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(''), FEEDBACK_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [feedback])

  // Novos colaboradores cadastrados aparecem na grade sem perder o rascunho.
  const assignments = useMemo(() => ensureRows(draft, team), [draft, team])
  const analysis = useMemo(() => analyzeSchedule(team, assignments), [team, assignments])
  const flaggedCells = useMemo(
    () =>
      new Set(
        analysis.issues
          .filter((i) => i.severity === 'erro' && i.colaboradorId && i.day !== undefined)
          .map((i) => `${i.colaboradorId}-${i.day}`),
      ),
    [analysis.issues],
  )

  const isEmpty = Object.values(assignments).every((week) => week.every((s) => s === null))
  const isCurrentWeek = weekStart === getWeekStart()
  const blockingCount = analysis.issues.filter((i) => i.severity !== 'info').length
  const folgasOk = team.filter((c) => analysis.people[c.id]?.folgas === 1).length
  const shiftTotals = analysis.coverage.reduce(
    (acc, d) => ({ manha: acc.manha + d.manha, tarde: acc.tarde + d.tarde }),
    { manha: 0, tarde: 0 },
  )

  function handleCellChange(colaboradorId: string, day: ScheduleDayIndex, shift: ShiftCode | null) {
    setDraft((prev) => {
      const next = ensureRows(prev, team)
      next[colaboradorId][day] = shift
      return next
    })
    setOrigem('manual')
    setDirty(true)
  }

  function runAi() {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setAiStep(0)
    AI_STEPS.forEach((_, index) => {
      timers.current.push(window.setTimeout(() => setAiStep(index), index * AI_STEP_MS))
    })
    timers.current.push(
      window.setTimeout(() => {
        try {
          const teamIds = new Set(team.map((c) => c.id))
          const workload = buildRecentWorkload(
            getMockGestaoDataset().pontos.filter((p) => teamIds.has(p.colaboradorId)),
            startOfToday(),
          )
          const result = generateSchedule({ team, workload, previous: previousWeek?.assignments })
          setDraft(result.assignments)
          setNotes(result.notes)
          setOrigem('ia')
          setDirty(true)
          setFeedback('Escala gerada! Revise, ajuste o que quiser e salve.')
        } catch (err) {
          console.error(err)
          setFeedback('')
          setNotes([
            { id: 'erro', tone: 'alerta', title: 'Não foi possível gerar a escala', detail: 'Tente novamente ou preencha manualmente.' },
          ])
        } finally {
          setAiStep(null)
        }
      }, AI_STEPS.length * AI_STEP_MS),
    )
  }

  function copyPreviousWeek() {
    if (!previousWeek) return
    setDraft(ensureRows(previousWeek.assignments, team))
    setOrigem('manual')
    setNotes(null)
    setDirty(true)
    setFeedback('Escala da semana anterior copiada.')
  }

  function clearSchedule() {
    setDraft(ensureRows({}, team))
    setNotes(null)
    setOrigem('manual')
    setDirty(true)
    setConfirmClear(false)
  }

  function save() {
    saveEscala(unitId, weekStart, assignments, origem)
    setDirty(false)
    setFeedback('Escala salva.')
  }

  const statusLabel = dirty
    ? 'Alterações não salvas'
    : saved
      ? `Salva em ${new Date(saved.atualizadaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${saved.origem === 'ia' ? ' · gerada pela IA' : ''}`
      : 'Ainda não montada'

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--pv-surface)] p-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onWeekChange(shiftWeek(weekStart, -1))} aria-label="Semana anterior">
            <ChevronLeft size={16} />
          </Button>
          <div className="min-w-[170px] text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-[1px] text-[var(--pv-muted)]">
              {isCurrentWeek ? 'Esta semana' : 'Semana'}
            </p>
            <p className="font-display text-lg text-[var(--pv-ink)]">{formatWeekRange(weekStart)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onWeekChange(shiftWeek(weekStart, 1))} aria-label="Próxima semana">
            <ChevronRight size={16} />
          </Button>
          {!isCurrentWeek ? (
            <button
              type="button"
              onClick={() => onWeekChange(getWeekStart())}
              className="ml-1 text-xs font-bold text-[var(--pv-terracotta)] hover:underline"
            >
              Ir para esta semana
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-bold',
              dirty ? 'bg-[#FBF1DC] text-[#A6791F]' : saved ? 'bg-[var(--pv-success-bg)] text-[var(--pv-success)]' : 'bg-[#EDE8DA] text-[var(--pv-muted)]',
            )}
          >
            {statusLabel}
          </span>
          <Button variant="ghost" size="sm" onClick={copyPreviousWeek} disabled={!previousWeek || aiStep !== null}>
            <Copy size={14} /> Copiar semana anterior
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} disabled={isEmpty || aiStep !== null}>
            <Eraser size={14} /> Limpar
          </Button>
          <Button variant="navy" size="sm" onClick={runAi} disabled={aiStep !== null || team.length === 0}>
            {aiStep !== null ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Gerar com IA
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || aiStep !== null}>
            <Save size={14} /> Salvar escala
          </Button>
        </div>
      </section>

      {feedback ? <Alert tone="success">{feedback}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<ShieldCheck size={18} />}
          label="Cobertura mínima"
          value={isEmpty ? '—' : `${analysis.coverageScore}%`}
          hint="Turnos com a equipe mínima por cargo"
          tone={analysis.coverageScore >= 95 ? 'good' : analysis.coverageScore >= 80 ? 'warn' : 'bad'}
          muted={isEmpty}
        />
        <StatTile
          icon={<CalendarCheck size={18} />}
          label="Folgas 6x1"
          value={`${folgasOk}/${team.length}`}
          hint="Colaboradores com exatamente 1 folga"
          tone={folgasOk === team.length ? 'good' : 'warn'}
          muted={isEmpty}
        />
        <StatTile
          icon={<TriangleAlert size={18} />}
          label="Pendências"
          value={String(blockingCount)}
          hint="Erros de descanso e falta de cobertura"
          tone={blockingCount === 0 ? 'good' : 'bad'}
          muted={isEmpty}
        />
        <StatTile
          icon={<Users size={18} />}
          label="Turnos na semana"
          value={`${shiftTotals.manha + shiftTotals.tarde}`}
          hint={`${shiftTotals.manha} manhã · ${shiftTotals.tarde} tarde/noite`}
          tone="neutral"
          muted={isEmpty}
        />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1fr_360px]">
        <SectionCard
          title="Escala da semana"
          subtitle="Clique em qualquer célula para trocar o turno"
          action={<ShiftLegend />}
          className="relative min-w-0"
        >
          {isEmpty && aiStep === null ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--pv-terracotta)]/40 bg-[#FDF3EF] px-4 py-3">
              <p className="text-sm text-[var(--pv-ink)]">
                <span className="font-bold">Escala ainda não montada.</span> Deixe a IA montar em segundos ou preencha
                manualmente.
              </p>
              <Button size="sm" variant="navy" onClick={runAi} disabled={team.length === 0}>
                <Sparkles size={14} /> Gerar com IA
              </Button>
            </div>
          ) : null}

          {team.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--pv-muted)]">
              Nenhum colaborador ativo nesta unidade. Cadastre a equipe na aba Colaboradores.
            </p>
          ) : (
            <ScheduleGrid
              team={team}
              weekStart={weekStart}
              assignments={assignments}
              people={analysis.people}
              coverage={analysis.coverage}
              flaggedCells={flaggedCells}
              onChange={handleCellChange}
            />
          )}

          {aiStep !== null ? <AiOverlay step={aiStep} /> : null}
        </SectionCard>

        <div className="space-y-5">
          {notes ? <ScheduleAiNotes notes={notes} /> : <AiHowItWorks />}
          <SectionCard title="Validação da escala" subtitle="Atualiza a cada mudança">
            {isEmpty ? (
              <p className="text-sm text-[var(--pv-muted)]">Monte a escala para ver as validações.</p>
            ) : (
              <ScheduleIssues issues={analysis.issues} />
            )}
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Limpar escala"
        confirmLabel="Limpar tudo"
        onClose={() => setConfirmClear(false)}
        onConfirm={clearSchedule}
        description="Todos os turnos desta semana serão apagados do rascunho. A versão salva só muda se você salvar depois."
      />
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  hint,
  tone,
  muted,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
  tone: 'good' | 'warn' | 'bad' | 'neutral'
  muted: boolean
}) {
  const color = muted
    ? 'var(--pv-muted)'
    : { good: 'var(--pv-success)', warn: '#A6791F', bad: 'var(--pv-danger)', neutral: 'var(--pv-navy)' }[tone]
  return (
    <article className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl">
      <span className="inline-flex rounded-xl bg-white p-2.5 shadow-sm" style={{ color }}>
        {icon}
      </span>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl leading-none" style={{ color }}>
        {value}
      </p>
      <p className="mt-2 text-[11.5px] font-medium text-[var(--pv-muted)]">{hint}</p>
    </article>
  )
}

function ShiftLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {SHIFT_CODES.map((code) => (
        <span
          key={code}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold"
          style={{ background: SHIFT_META[code].bg, color: SHIFT_META[code].color }}
        >
          {SHIFT_META[code].label}
          {code !== 'folga' ? <span className="font-semibold opacity-75">{SHIFT_META[code].hours}</span> : null}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--pv-muted)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--pv-success)]" /> folga preferida
      </span>
    </div>
  )
}

function AiOverlay({ step }: { step: number }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-[rgba(14,23,48,0.72)] backdrop-blur-sm">
      <div className="w-[min(420px,90%)] rounded-2xl bg-[var(--pv-surface)] p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--pv-terracotta)] to-[#F08A72] text-white">
            <Sparkles size={18} className="animate-pulse" />
          </span>
          <div>
            <p className="font-display text-base text-[var(--pv-ink)]">Montando a escala…</p>
            <p className="text-xs text-[var(--pv-muted)]">A IA está analisando a equipe da unidade</p>
          </div>
        </div>
        <ol className="mt-5 space-y-2.5">
          {AI_STEPS.map((label, index) => (
            <li
              key={label}
              className={cn(
                'flex items-center gap-2.5 text-sm transition',
                index < step ? 'text-[var(--pv-success)]' : index === step ? 'font-semibold text-[var(--pv-ink)]' : 'text-[#A9A493]',
              )}
            >
              {index < step ? (
                <ShieldCheck size={15} />
              ) : index === step ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <span className="h-[15px] w-[15px] rounded-full border border-current" />
              )}
              {label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function AiHowItWorks() {
  const items = [
    'Respeita a escala 6x1: 1 folga por pessoa',
    'Evita folgas de sexta a domingo e reforça o salão',
    'Garante 11h de descanso entre fechar e abrir a casa',
    'Considera cargo, turno preferido e pedido de folga',
    'Dá o domingo a quem mais trabalhou nas últimas 2 semanas',
  ]
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#22336A] via-[#1A2853] to-[#121D40] p-5 shadow-2xl">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--pv-terracotta)]/25 blur-3xl" />
      <div className="relative flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--pv-terracotta)] to-[#F08A72] text-white">
          <Sparkles size={17} />
        </span>
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[1.4px] text-[var(--pv-cream)]/65">Escala com IA</p>
          <h3 className="font-display text-base text-white">O que a IA leva em conta</h3>
        </div>
      </div>
      <ul className="relative mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[13px] text-[var(--pv-cream)]/85">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#6FD49A]" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}
