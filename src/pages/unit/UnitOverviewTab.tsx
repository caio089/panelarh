import { useState } from 'react'
import { OCCURRENCE_TYPES } from '@/features/gestao/constants'
import type { CollaboratorStats } from '@/features/gestao/metrics'
import { useGestao } from '@/features/gestao/useGestao'
import { usePeriodParam } from '@/features/gestao/usePeriodParam'
import { AiSummaryPanel } from '@/features/gestao/components/AiSummaryPanel'
import { PeriodSelect, SectionCard } from '@/features/gestao/components/atoms'
import { CollaboratorDetailModal } from '@/features/gestao/components/CollaboratorDetailModal'
import { CollaboratorTable } from '@/features/gestao/components/CollaboratorTable'
import { OccurrenceKpiCard } from '@/features/gestao/components/OccurrenceKpiCard'
import { OccurrenceTrendChart } from '@/features/gestao/components/OccurrenceTrendChart'
import { PunctualityBreakdown } from '@/features/gestao/components/PunctualityBreakdown'
import { DirceuOverview } from '@/features/dirceu/DirceuOverview'
import { useUnitContext } from './unitContext'

/** Indicadores da unidade e detalhamento por colaborador. */
export function UnitOverviewTab() {
  const { unitId, unitName } = useUnitContext()
  const [period, setPeriod] = usePeriodParam()
  const view = useGestao(period, unitId)
  const [selected, setSelected] = useState<CollaboratorStats | null>(null)

  const showsSaipos = unitId === 'unit-dirceu'

  return (
    <div className="pv-stagger space-y-5">
      {showsSaipos ? <DirceuOverview paramPrefix="ops" /> : null}
      <div className="flex justify-end">
        <PeriodSelect value={period} onChange={setPeriod} />
      </div>

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

      <SectionCard title="Colaboradores" subtitle="Faltas, advertências, atestados, suspensões e ponto de cada pessoa no período">
        <CollaboratorTable stats={view.collaborators} onSelect={setSelected} />
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <SectionCard title="Evolução das ocorrências" subtitle="Últimos 6 meses nesta unidade">
          <OccurrenceTrendChart series={view.monthlySeries} />
        </SectionCard>
        <SectionCard title="Ponto eletrônico" subtitle="Distribuição das entradas no período">
          <PunctualityBreakdown counts={view.punctuality} />
        </SectionCard>
      </div>

      <CollaboratorDetailModal
        stats={selected}
        dataset={view.dataset}
        range={view.ranges.current}
        unitName={unitName}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
