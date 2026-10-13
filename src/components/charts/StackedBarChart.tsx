import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface BarSegment {
  key: string
  label: string
  value: number
  color: string
}

export interface BarDatum {
  label: string
  segments: BarSegment[]
}

interface StackedBarChartProps {
  data: BarDatum[]
  height?: number
  /** Sufixo exibido nos valores (ex.: "%"). */
  valueSuffix?: string
  /** Valor máximo fixo do eixo; por padrão usa o maior total. */
  maxValue?: number
}

const GRID_LINES = 4

/** Colunas empilhadas responsivas (HTML/CSS), com destaque e tooltip ao passar o mouse. */
export function StackedBarChart({ data, height = 220, valueSuffix = '', maxValue }: StackedBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const totals = data.map((d) => d.segments.reduce((sum, s) => sum + s.value, 0))
  const max = Math.max(maxValue ?? 0, ...totals, 1)
  const niceMax = Math.ceil(max / GRID_LINES) * GRID_LINES

  return (
    <div className="flex gap-3">
      <div className="flex flex-col justify-between pb-7 text-right text-[10px] font-semibold text-[#A9A493]" style={{ height }}>
        {Array.from({ length: GRID_LINES + 1 }, (_, i) => (
          <span key={i}>
            {Math.round((niceMax / GRID_LINES) * (GRID_LINES - i))}
            {valueSuffix}
          </span>
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: height - 28 }}>
          {Array.from({ length: GRID_LINES + 1 }, (_, i) => (
            <div key={i} className="border-t border-dashed border-[#E7E2D3]" />
          ))}
        </div>

        <div className="relative flex items-end gap-2 sm:gap-4" style={{ height }}>
          {data.map((datum, index) => {
            const total = totals[index]
            const isActive = hovered === index
            const barHeight = (total / niceMax) * (height - 28)
            return (
              <div
                key={datum.label}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              >
                {isActive ? (
                  <div
                    className="pointer-events-none absolute left-1/2 z-10 min-w-[150px] -translate-x-1/2 rounded-xl bg-[var(--pv-navy-deep)] px-3 py-2 text-[11px] text-white shadow-xl"
                    style={{ bottom: Math.min(barHeight + 36, height - 20) }}
                  >
                    <p className="mb-1 font-bold text-[var(--pv-cream)]">{datum.label}</p>
                    {datum.segments.map((s) => (
                      <div key={s.key} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                          {s.label}
                        </span>
                        <span className="font-bold">
                          {s.value}
                          {valueSuffix}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div
                  className={cn(
                    'flex w-full max-w-[46px] flex-col-reverse overflow-hidden rounded-t-lg transition-all duration-300',
                    hovered !== null && !isActive && 'opacity-45',
                  )}
                  style={{ height: `${barHeight}px` }}
                >
                  {datum.segments.map((s) => (
                    <div
                      key={s.key}
                      style={{ height: total ? `${(s.value / total) * 100}%` : 0, background: s.color }}
                      className="w-full"
                    />
                  ))}
                </div>
                <span className="mt-2 h-5 text-[11px] font-bold text-[var(--pv-muted)]">{datum.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
