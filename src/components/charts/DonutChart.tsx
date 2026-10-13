import type { ReactNode } from 'react'

export interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  slices: DonutSlice[]
  size?: number
  thickness?: number
  center?: ReactNode
}

/** Gráfico de rosca em SVG puro usando stroke-dasharray. */
export function DonutChart({ slices, size = 168, thickness = 18, center }: DonutChartProps) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const gap = total > 0 && slices.filter((s) => s.value > 0).length > 1 ? 3 : 0

  let offset = 0
  const arcs = slices.map((slice) => {
    const length = total ? (slice.value / total) * circumference : 0
    const arc = { ...slice, length: Math.max(0, length - gap), offset }
    offset += length
    return arc
  })

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img">
        <title>{slices.map((s) => `${s.label}: ${s.value}`).join(', ')}</title>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EDE8DA" strokeWidth={thickness} />
        {arcs.map((arc) =>
          arc.length > 0 ? (
            <circle
              key={arc.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${arc.length} ${circumference}`}
              strokeDashoffset={-arc.offset}
              className="transition-all duration-700"
            />
          ) : null,
        )}
      </svg>
      {center ? <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div> : null}
    </div>
  )
}
