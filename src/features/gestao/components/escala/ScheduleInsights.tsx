import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Sparkles, type LucideIcon } from 'lucide-react'
import type { IssueSeverity, ScheduleIssue } from '../../escala/analysis'
import type { NoteTone, ScheduleNote } from '../../escala/scheduler'

const NOTE_META: Record<NoteTone, { icon: LucideIcon; color: string }> = {
  sucesso: { icon: CheckCircle2, color: '#6FD49A' },
  info: { icon: Info, color: '#9DB8E6' },
  alerta: { icon: AlertTriangle, color: '#F2C46D' },
}

const ISSUE_META: Record<IssueSeverity, { icon: LucideIcon; className: string }> = {
  erro: { icon: AlertOctagon, className: 'bg-[var(--pv-danger-bg)] text-[var(--pv-danger)]' },
  alerta: { icon: AlertTriangle, className: 'bg-[#FBF1DC] text-[#A6791F]' },
  info: { icon: Info, className: 'bg-[#E8F1FA] text-[#3B6EA5]' },
}

const MAX_VISIBLE_ISSUES = 8

/** Explicação da IA sobre a escala gerada. */
export function ScheduleAiNotes({ notes }: { notes: ScheduleNote[] }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#22336A] via-[#1A2853] to-[#121D40] p-5 shadow-2xl">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--pv-terracotta)]/25 blur-3xl" />
      <div className="relative flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--pv-terracotta)] to-[#F08A72] text-white">
          <Sparkles size={17} />
        </span>
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[1.4px] text-[var(--pv-cream)]/65">Análise da IA</p>
          <h3 className="font-display text-base text-white">Como a escala foi montada</h3>
        </div>
      </div>
      <ul className="relative mt-4 space-y-3">
        {notes.map((note) => {
          const meta = NOTE_META[note.tone]
          const Icon = meta.icon
          return (
            <li key={note.id} className="flex gap-2.5">
              <Icon size={16} className="mt-0.5 shrink-0" style={{ color: meta.color }} />
              <div>
                <p className="text-[13px] font-semibold leading-snug text-white">{note.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--pv-cream)]/65">{note.detail}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Lista de validações da escala atual (atualiza a cada edição). */
export function ScheduleIssues({ issues }: { issues: ScheduleIssue[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-[var(--pv-success-bg)] px-4 py-3 text-sm font-semibold text-[var(--pv-success)]">
        <CheckCircle2 size={16} /> Escala sem pendências: folgas, descanso entre turnos e cobertura em dia.
      </div>
    )
  }

  const visible = issues.slice(0, MAX_VISIBLE_ISSUES)
  return (
    <ul className="space-y-2">
      {visible.map((issue) => {
        const meta = ISSUE_META[issue.severity]
        const Icon = meta.icon
        return (
          <li key={issue.id} className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold ${meta.className}`}>
            <Icon size={15} className="mt-0.5 shrink-0" />
            <span className="leading-snug">{issue.message}</span>
          </li>
        )
      })}
      {issues.length > visible.length ? (
        <li className="px-1 text-xs font-semibold text-[var(--pv-muted)]">+ {issues.length - visible.length} outros pontos</li>
      ) : null}
    </ul>
  )
}
