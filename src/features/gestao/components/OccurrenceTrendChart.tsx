import { StackedBarChart } from '@/components/charts/StackedBarChart'
import { OCCURRENCE_META, OCCURRENCE_TYPES } from '../constants'
import type { MonthlyBucket } from '../metrics'
import { ChartLegend } from './atoms'

/** Evolução mensal das ocorrências, empilhada por tipo. */
export function OccurrenceTrendChart({ series }: { series: MonthlyBucket[] }) {
  return (
    <div>
      <ChartLegend
        items={OCCURRENCE_TYPES.map((t) => ({ key: t, label: OCCURRENCE_META[t].plural, color: OCCURRENCE_META[t].color }))}
      />
      <StackedBarChart
        data={series.map((bucket) => ({
          label: bucket.label,
          segments: OCCURRENCE_TYPES.map((t) => ({
            key: t,
            label: OCCURRENCE_META[t].plural,
            value: bucket.counts[t],
            color: OCCURRENCE_META[t].color,
          })),
        }))}
      />
      <p className="mt-1 text-[10.5px] text-[#A9A493]">O mês atual ainda está em andamento.</p>
    </div>
  )
}
