import { CalendarX2, FileWarning, Ban, Stethoscope, type LucideIcon } from 'lucide-react'
import { Sparkline } from '@/components/charts/Sparkline'
import { OCCURRENCE_META } from '../constants'
import { percentChange } from '../metrics'
import type { OccurrenceType } from '../types'
import { DeltaBadge } from './atoms'

const OCCURRENCE_ICONS: Record<OccurrenceType, LucideIcon> = {
  falta: CalendarX2,
  advertencia: FileWarning,
  atestado: Stethoscope,
  suspensao: Ban,
}

interface OccurrenceKpiCardProps {
  type: OccurrenceType
  value: number
  previous: number
  sparkline: number[]
  /** Quantas pessoas diferentes tiveram esse tipo de ocorrência no período. */
  peopleAffected: number
}

/** KPI de um tipo de ocorrência com variação e tendência das últimas 12 semanas. */
export function OccurrenceKpiCard({ type, value, previous, sparkline, peopleAffected }: OccurrenceKpiCardProps) {
  const meta = OCCURRENCE_META[type]
  const Icon = OCCURRENCE_ICONS[type]

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl transition hover:-translate-y-0.5">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: meta.color }} />
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex rounded-xl p-2.5" style={{ background: meta.bg, color: meta.color }}>
          <Icon size={18} />
        </span>
        <DeltaBadge change={percentChange(value, previous)} />
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-muted)]">{meta.plural}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="font-display text-4xl leading-none text-[var(--pv-ink)]">{value}</p>
        <Sparkline values={sparkline} color={meta.color} height={36} className="w-24" />
      </div>
      <p className="mt-2 text-[11.5px] font-medium text-[var(--pv-muted)]">
        {peopleAffected} {peopleAffected === 1 ? 'pessoa envolvida' : 'pessoas envolvidas'} · antes {previous}
      </p>
    </article>
  )
}
