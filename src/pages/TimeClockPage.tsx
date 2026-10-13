import { useMemo, useState, type ReactNode } from 'react'
import { AlarmClock, CheckCircle2, Hourglass, TimerOff } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { useData } from '@/contexts/DataContext'
import { cn } from '@/lib/utils'
import { StackedBarChart } from '@/components/charts/StackedBarChart'
import { PUNCTUALITY_META, PUNCTUALITY_STATUSES, WEEKDAY_SHORT } from '@/features/gestao/constants'
import { filterByRange, punctualityShare, punctualityTotal, type CollaboratorStats } from '@/features/gestao/metrics'
import { useGestao } from '@/features/gestao/useGestao'
import { usePeriodParam } from '@/features/gestao/usePeriodParam'
import { Avatar, ChartLegend, PeriodSelect, SectionCard, SyncBadge } from '@/features/gestao/components/atoms'
import { CollaboratorDetailModal } from '@/features/gestao/components/CollaboratorDetailModal'

const RANKING_SIZE = 6
/** Mínimo de batidas para entrar nos rankings (evita distorção com poucos dados). */
const MIN_PUNCHES_FOR_RANKING = 8

/** Módulo de ponto eletrônico: quem chega com folga, no limite ou atrasado. */
export function TimeClockPage() {
  const { store } = useData()
  const [period, setPeriod] = usePeriodParam()
  const [unitFilter, setUnitFilter] = useState<string>('')
  const view = useGestao(period, unitFilter || undefined)
  const [selected, setSelected] = useState<CollaboratorStats | null>(null)

  const unitNameById = useMemo(() => new Map(store.units.map((u) => [u.id, u.name])), [store.units])

  const averageDelay = useMemo(() => {
    const late = filterByRange(view.dataset.pontos, view.ranges.current).filter((p) => p.diferencaMin > 0)
    return late.length ? Math.round(late.reduce((sum, p) => sum + p.diferencaMin, 0) / late.length) : 0
  }, [view.dataset.pontos, view.ranges])

  const rankings = useMemo(() => {
    const eligible = view.collaborators.filter((c) => punctualityTotal(c.punctuality) >= MIN_PUNCHES_FOR_RANKING)
    return {
      late: [...eligible]
        .filter((c) => c.punctuality.atrasado > 0)
        .sort((a, b) => b.punctuality.atrasado - a.punctuality.atrasado)
        .slice(0, RANKING_SIZE),
      edge: [...eligible]
        .sort((a, b) => punctualityShare(b.punctuality, 'no_limite') - punctualityShare(a.punctuality, 'no_limite'))
        .slice(0, RANKING_SIZE),
      best: [...eligible]
        .filter((c) => c.punctuality.atrasado === 0)
        .sort((a, b) => b.punctualityRate - a.punctualityRate)
        .slice(0, RANKING_SIZE),
    }
  }, [view.collaborators])

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <div className="animate-fade-up">
        <PageHeader
          eyebrow="Ponto eletrônico"
          title="Pontualidade da equipe"
          description="Quem chega com folga, quem bate o ponto em cima do horário e quem está chegando atrasado."
          actions={
            <>
              <SyncBadge syncedAt={view.dataset.sincronizadoEm} />
              <PeriodSelect value={period} onChange={setPeriod} />
            </>
          }
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <UnitChip active={!unitFilter} onClick={() => setUnitFilter('')} label="Todas as unidades" />
        {store.units.map((u) => (
          <UnitChip key={u.id} active={unitFilter === u.id} onClick={() => setUnitFilter(u.id)} label={u.name} />
        ))}
      </div>

      <div className="pv-stagger mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            icon={<CheckCircle2 size={18} />}
            color={PUNCTUALITY_META.pontual.color}
            label="Chegam com folga"
            value={`${punctualityShare(view.punctuality, 'pontual')}%`}
            hint={`${view.punctuality.pontual} batidas`}
          />
          <MetricTile
            icon={<Hourglass size={18} />}
            color={PUNCTUALITY_META.no_limite.color}
            label="Em cima do horário"
            value={`${punctualityShare(view.punctuality, 'no_limite')}%`}
            hint={`${view.punctuality.no_limite} batidas`}
          />
          <MetricTile
            icon={<TimerOff size={18} />}
            color={PUNCTUALITY_META.atrasado.color}
            label="Atrasados"
            value={`${punctualityShare(view.punctuality, 'atrasado')}%`}
            hint={`${view.punctuality.atrasado} batidas`}
          />
          <MetricTile
            icon={<AlarmClock size={18} />}
            color="var(--pv-navy)"
            label="Atraso médio"
            value={`${averageDelay} min`}
            hint="Considerando só as entradas após o horário"
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard title="Pontualidade por unidade" subtitle="Distribuição percentual das entradas">
            <ChartLegend
              items={PUNCTUALITY_STATUSES.map((s) => ({ key: s, label: PUNCTUALITY_META[s].label, color: PUNCTUALITY_META[s].color }))}
            />
            <StackedBarChart
              valueSuffix="%"
              maxValue={100}
              data={view.units.map((u) => ({
                label: u.unitName,
                segments: PUNCTUALITY_STATUSES.map((s) => ({
                  key: s,
                  label: PUNCTUALITY_META[s].label,
                  value: punctualityShare(u.punctuality, s),
                  color: PUNCTUALITY_META[s].color,
                })),
              }))}
            />
          </SectionCard>
          <SectionCard title="Atrasos por dia da semana" subtitle="% das entradas fora da tolerância">
            <StackedBarChart
              valueSuffix="%"
              data={WEEKDAY_SHORT.map((day, i) => ({
                label: day,
                segments: [{ key: 'late', label: 'Atrasos', value: view.weekdayLateness[i], color: PUNCTUALITY_META.atrasado.color }],
              }))}
            />
          </SectionCard>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <SectionCard title="Mais atrasos" subtitle="Quantidade de entradas fora da tolerância">
            <RankingList
              items={rankings.late}
              unitNameById={unitNameById}
              onSelect={setSelected}
              metric={(c) => ({ value: `${c.punctuality.atrasado}x`, hint: `média +${c.averageDelayMin} min` })}
              color={PUNCTUALITY_META.atrasado.color}
            />
          </SectionCard>
          <SectionCard title="Sempre em cima do horário" subtitle="Maior % de batidas no limite">
            <RankingList
              items={rankings.edge}
              unitNameById={unitNameById}
              onSelect={setSelected}
              metric={(c) => ({ value: `${punctualityShare(c.punctuality, 'no_limite')}%`, hint: 'no limite' })}
              color={PUNCTUALITY_META.no_limite.color}
            />
          </SectionCard>
          <SectionCard title="Exemplos de pontualidade" subtitle="Nenhum atraso e mais folga na chegada">
            <RankingList
              items={rankings.best}
              unitNameById={unitNameById}
              onSelect={setSelected}
              metric={(c) => ({ value: `${c.punctualityRate}%`, hint: 'com folga' })}
              color={PUNCTUALITY_META.pontual.color}
            />
          </SectionCard>
        </div>
      </div>

      <CollaboratorDetailModal
        stats={selected}
        dataset={view.dataset}
        range={view.ranges.current}
        unitName={selected ? unitNameById.get(selected.colaborador.unitId) : undefined}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}

function UnitChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-xs font-bold transition',
        active
          ? 'border-[var(--pv-terracotta)] bg-[var(--pv-terracotta)] text-white'
          : 'border-white/15 text-[var(--pv-cream)]/75 hover:border-white/30 hover:text-white',
      )}
    >
      {label}
    </button>
  )
}

function MetricTile({
  icon,
  color,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  color: string
  label: string
  value: string
  hint: string
}) {
  return (
    <article className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl">
      <span className="inline-flex rounded-xl bg-white p-2.5 shadow-sm" style={{ color }}>
        {icon}
      </span>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-muted)]">{label}</p>
      <p className="mt-1 font-display text-4xl leading-none" style={{ color }}>
        {value}
      </p>
      <p className="mt-2 text-[11.5px] font-medium text-[var(--pv-muted)]">{hint}</p>
    </article>
  )
}

function RankingList({
  items,
  unitNameById,
  onSelect,
  metric,
  color,
}: {
  items: CollaboratorStats[]
  unitNameById: Map<string, string>
  onSelect: (stats: CollaboratorStats) => void
  metric: (stats: CollaboratorStats) => { value: string; hint: string }
  color: string
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--pv-muted)]">Ninguém nesta lista no período.</p>
  }
  return (
    <ol className="space-y-2">
      {items.map((c, index) => {
        const m = metric(c)
        return (
          <li key={c.colaborador.id}>
            <button
              type="button"
              onClick={() => onSelect(c)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--pv-line)] bg-white px-3 py-2 text-left transition hover:shadow-md"
            >
              <span className="w-4 text-center text-xs font-bold text-[#A9A493]">{index + 1}</span>
              <Avatar name={c.colaborador.nome} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-[var(--pv-ink)]">{c.colaborador.nome}</p>
                <p className="truncate text-[10.5px] font-medium text-[var(--pv-muted)]">
                  {c.colaborador.cargo} · {unitNameById.get(c.colaborador.unitId)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-base" style={{ color }}>
                  {m.value}
                </p>
                <p className="text-[10px] font-semibold text-[#A9A493]">{m.hint}</p>
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
