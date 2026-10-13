import type { ReactNode } from 'react'
import { Briefcase, ChevronRight, ShieldAlert, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui'
import { useData } from '@/contexts/DataContext'
import { OCCURRENCE_META, OCCURRENCE_TYPES, PUNCTUALITY_META } from '@/features/gestao/constants'
import { tenureLabel } from '@/features/gestao/dateUtils'
import { percentChange, totalOccurrences, type CollaboratorStats, type UnitSummary } from '@/features/gestao/metrics'
import { useGestao } from '@/features/gestao/useGestao'
import { usePeriodParam } from '@/features/gestao/usePeriodParam'
import { Avatar, DeltaBadge, PeriodSelect } from '@/features/gestao/components/atoms'

/** Visão dos gerentes: desempenho de cada um e da equipe que lideram. */
export function ManagersPage() {
  const [period, setPeriod] = usePeriodParam()
  const view = useGestao(period)

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <div className="animate-fade-up">
        <PageHeader
          eyebrow="Gestão"
          title="Gerentes"
          description="Como está cada gerente e a equipe que ele lidera."
          actions={<PeriodSelect value={period} onChange={setPeriod} />}
        />
      </div>

      <div className="pv-stagger mt-7 grid gap-5 lg:grid-cols-3">
        {view.units.map((unit) => (
          <ManagerCard
            key={unit.unitId}
            unit={unit}
            stats={view.collaborators.find((c) => c.colaborador.id === unit.gerente?.id) ?? null}
          />
        ))}
      </div>
    </div>
  )
}

function ManagerCard({ unit, stats }: { unit: UnitSummary; stats: CollaboratorStats | null }) {
  const { store } = useData()
  const openPositions = store.vagas.filter((v) => v.unit_id === unit.unitId && v.ativa).length
  const teamTotal = totalOccurrences(unit.occurrences)
  const change = percentChange(teamTotal, totalOccurrences(unit.previousOccurrences))
  const gerente = unit.gerente

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-[var(--pv-surface)] shadow-xl">
      <div className="relative bg-gradient-to-br from-[#22336A] to-[#121D40] px-5 pb-5 pt-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[var(--pv-terracotta)]/25 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <Avatar name={gerente?.nome ?? '?'} size={52} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg text-white">{gerente?.nome ?? 'Sem gerente'}</p>
            <p className="text-xs font-medium text-[var(--pv-cream)]/75">
              Gerente · {unit.unitName}
              {gerente ? ` · ${tenureLabel(gerente.admissao)}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Tile label="Saúde da equipe" value={`${unit.healthScore}`} suffix="/100" />
          <Tile label="Ponto próprio" value={`${stats?.punctualityRate ?? 0}%`} color={PUNCTUALITY_META.pontual.color} />
          <Tile label="Atrasos próprios" value={`${stats?.punctuality.atrasado ?? 0}`} color={PUNCTUALITY_META.atrasado.color} />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-muted)]">Ocorrências da equipe</p>
            <DeltaBadge change={change} />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {OCCURRENCE_TYPES.map((t) => (
              <div key={t} className="rounded-lg py-2 text-center" style={{ background: OCCURRENCE_META[t].bg }}>
                <p className="font-display text-lg leading-none" style={{ color: OCCURRENCE_META[t].color }}>
                  {unit.occurrences[t]}
                </p>
                <p className="mt-1 text-[9.5px] font-bold uppercase text-[var(--pv-muted)]">{OCCURRENCE_META[t].short}</p>
              </div>
            ))}
          </div>
        </div>

        <ul className="mt-5 space-y-2 text-sm">
          <InfoRow icon={<Users size={15} />} label="Equipe" value={`${unit.headcount} pessoas`} />
          <InfoRow
            icon={<ShieldAlert size={15} />}
            label="Em atenção"
            value={`${unit.collaboratorsAtRisk} colaborador${unit.collaboratorsAtRisk === 1 ? '' : 'es'}`}
          />
          <InfoRow icon={<Briefcase size={15} />} label="Vagas abertas" value={String(openPositions)} />
        </ul>

        <Link
          to={`/admin/unidade/${unit.unitId}`}
          className="mt-5 flex items-center justify-between rounded-xl border border-[var(--pv-line-strong)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--pv-navy)] transition hover:border-[var(--pv-terracotta)] hover:text-[var(--pv-terracotta)]"
        >
          Ver equipe da unidade <ChevronRight size={16} />
        </Link>
      </div>
    </article>
  )
}

function Tile({ label, value, suffix, color }: { label: string; value: string; suffix?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--pv-line)] bg-white px-2 py-3">
      <p className="font-display text-xl leading-none" style={{ color: color ?? 'var(--pv-ink)' }}>
        {value}
        {suffix ? <span className="text-xs text-[#A9A493]">{suffix}</span> : null}
      </p>
      <p className="mt-1.5 text-[9.5px] font-bold uppercase leading-tight text-[var(--pv-muted)]">{label}</p>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-[#F4F0E4] px-3 py-2">
      <span className="flex items-center gap-2 font-semibold text-[var(--pv-muted)]">
        {icon} {label}
      </span>
      <span className="font-bold text-[var(--pv-ink)]">{value}</span>
    </li>
  )
}
