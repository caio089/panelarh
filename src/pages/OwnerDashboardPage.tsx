import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui'
import { OCCURRENCE_TYPES } from '@/features/gestao/constants'
import type { CollaboratorStats } from '@/features/gestao/metrics'
import { useGestao } from '@/features/gestao/useGestao'
import { usePeriodParam } from '@/features/gestao/usePeriodParam'
import { AiSummaryPanel } from '@/features/gestao/components/AiSummaryPanel'
import { PeriodSelect, SectionCard, SectionLink, SyncBadge } from '@/features/gestao/components/atoms'
import { CollaboratorDetailModal } from '@/features/gestao/components/CollaboratorDetailModal'
import { OccurrenceKpiCard } from '@/features/gestao/components/OccurrenceKpiCard'
import { OccurrenceTrendChart } from '@/features/gestao/components/OccurrenceTrendChart'
import { PunctualityBreakdown } from '@/features/gestao/components/PunctualityBreakdown'
import { RhSnapshot } from '@/features/gestao/components/RhSnapshot'
import { UnitCard } from '@/features/gestao/components/UnitCard'
import { WatchList } from '@/features/gestao/components/WatchList'

const WATCHLIST_SIZE = 6

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Painel principal dos sócios: visão consolidada da rede. */
export function OwnerDashboardPage() {
  const [period, setPeriod] = usePeriodParam()
  const view = useGestao(period)
  const [selected, setSelected] = useState<CollaboratorStats | null>(null)

  const unitNameById = useMemo(() => new Map(view.units.map((u) => [u.unitId, u.unitName])), [view.units])
  const watchList = useMemo(
    () =>
      view.collaborators
        .filter((c) => c.riskLevel !== 'ok')
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, WATCHLIST_SIZE),
    [view.collaborators],
  )
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <div className="animate-fade-up">
        <PageHeader
          eyebrow="Painel dos sócios"
          title={`${greeting()}, Matheus e Andressa`}
          description={`Tudo o que está acontecendo nas ${view.units.length} unidades, em um só lugar · ${today}.`}
          actions={
            <>
              <SyncBadge syncedAt={view.dataset.sincronizadoEm} />
              <PeriodSelect value={period} onChange={setPeriod} />
            </>
          }
        />
      </div>

      <div className="pv-stagger mt-7 space-y-5">
        <AiSummaryPanel summary={view.summary} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {OCCURRENCE_TYPES.map((type) => (
            <OccurrenceKpiCard
              key={type}
              type={type}
              value={view.occurrences[type]}
              previous={view.previousOccurrences[type]}
              sparkline={view.sparklines[type]}
              peopleAffected={view.peopleAffected[type]}
            />
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <SectionCard title="Evolução das ocorrências" subtitle="Últimos 6 meses, por tipo">
            <OccurrenceTrendChart series={view.monthlySeries} />
          </SectionCard>
          <SectionCard
            title="Ponto eletrônico"
            subtitle="Como a equipe está chegando"
            action={<SectionLink to={`/admin/ponto${period === '30d' ? '' : `?periodo=${period}`}`} label="Detalhes" />}
          >
            <PunctualityBreakdown counts={view.punctuality} />
          </SectionCard>
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="pv-eyebrow">Unidades</p>
              <h2 className="font-display text-2xl text-[#F7F4EC]">Clique para ver por colaborador</h2>
            </div>
            <SectionLink to="/admin/gerentes" label="Ver gerentes" dark />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {view.units.map((unit) => (
              <UnitCard key={unit.unitId} unit={unit} />
            ))}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <SectionCard title="Colaboradores em atenção" subtitle="Maior score de risco no período (faltas, advertências, suspensões e atrasos)">
            <WatchList items={watchList} unitNameById={unitNameById} onSelect={setSelected} />
          </SectionCard>
          <SectionCard
            title="Recrutamento & banco de talentos"
            subtitle="Módulo de RH"
            action={<SectionLink to="/admin/vagas" label="Vagas" />}
          >
            <RhSnapshot />
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