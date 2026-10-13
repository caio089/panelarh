import { DonutChart } from '@/components/charts/DonutChart'
import { PUNCTUALITY_META, PUNCTUALITY_RULES, PUNCTUALITY_STATUSES } from '../constants'
import { punctualityShare, punctualityTotal } from '../metrics'
import type { PunctualityCounts } from '../types'

/** Rosca + legenda com a distribuição das batidas de ponto. */
export function PunctualityBreakdown({ counts }: { counts: PunctualityCounts }) {
  const total = punctualityTotal(counts)

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <DonutChart
        slices={PUNCTUALITY_STATUSES.map((s) => ({
          key: s,
          label: PUNCTUALITY_META[s].label,
          value: counts[s],
          color: PUNCTUALITY_META[s].color,
        }))}
        center={
          <>
            <span className="font-display text-3xl text-[var(--pv-ink)]">{punctualityShare(counts, 'pontual')}%</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--pv-muted)]">com folga</span>
          </>
        }
      />

      <ul className="w-full flex-1 space-y-3">
        {PUNCTUALITY_STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-3">
            <span className="h-9 w-1.5 rounded-full" style={{ background: PUNCTUALITY_META[s].color }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--pv-ink)]">{PUNCTUALITY_META[s].label}</p>
              <p className="text-[11px] font-medium text-[var(--pv-muted)]">{PUNCTUALITY_META[s].hint}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-lg" style={{ color: PUNCTUALITY_META[s].color }}>
                {punctualityShare(counts, s)}%
              </p>
              <p className="text-[10.5px] font-semibold text-[#A9A493]">{counts[s]} batidas</p>
            </div>
          </li>
        ))}
        <li className="pt-1 text-[10.5px] font-medium leading-relaxed text-[#A9A493]">
          {total} batidas · folga ≥ {PUNCTUALITY_RULES.folgaMinimaMin} min · tolerância {PUNCTUALITY_RULES.toleranciaMin} min
        </li>
      </ul>
    </div>
  )
}
