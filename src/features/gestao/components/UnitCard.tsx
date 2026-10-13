import { ChevronRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { OCCURRENCE_META, OCCURRENCE_TYPES, PUNCTUALITY_META, PUNCTUALITY_STATUSES } from '../constants'
import { percentChange, totalOccurrences, type UnitSummary } from '../metrics'
import { Avatar, DeltaBadge, SegmentedBar } from './atoms'

function healthTone(score: number) {
  if (score >= 75) return { color: '#2F7D4F', label: 'Saudável' }
  if (score >= 55) return { color: '#D08A1E', label: 'Atenção' }
  return { color: '#B23B3B', label: 'Crítica' }
}

/** Cartão clicável de unidade: leva à visão detalhada por colaborador. */
export function UnitCard({ unit }: { unit: UnitSummary }) {
  const tone = healthTone(unit.healthScore)
  const total = totalOccurrences(unit.occurrences)
  const change = percentChange(total, totalOccurrences(unit.previousOccurrences))

  return (
    <Link
      to={`/admin/unidade/${unit.unitId}`}
      className="group block rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl transition duration-200 hover:-translate-y-1 hover:shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[var(--pv-terracotta)]">Unidade</p>
          <h3 className="font-display text-xl text-[var(--pv-ink)]">{unit.unitName}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[var(--pv-muted)]">
            <Users size={13} /> {unit.headcount} colaboradores
          </p>
        </div>
        <HealthRing score={unit.healthScore} color={tone.color} label={tone.label} />
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {OCCURRENCE_TYPES.map((type) => (
          <div key={type} className="rounded-xl px-2 py-2.5 text-center" style={{ background: OCCURRENCE_META[type].bg }}>
            <p className="font-display text-xl leading-none" style={{ color: OCCURRENCE_META[type].color }}>
              {unit.occurrences[type]}
            </p>
            <p className="mt-1 truncate text-[10px] font-bold uppercase text-[var(--pv-muted)]" title={OCCURRENCE_META[type].plural}>
              {OCCURRENCE_META[type].short}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-[var(--pv-muted)]">
          <span>Ponto eletrônico</span>
          <span className="text-[var(--pv-success)]">{unit.punctualityRate}% com folga</span>
        </div>
        <SegmentedBar
          segments={PUNCTUALITY_STATUSES.map((s) => ({
            key: s,
            label: PUNCTUALITY_META[s].label,
            value: unit.punctuality[s],
            color: PUNCTUALITY_META[s].color,
          }))}
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--pv-line)] pt-4">
        {unit.gerente ? (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={unit.gerente.nome} size={30} />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[var(--pv-ink)]">{unit.gerente.nome}</p>
              <p className="text-[10.5px] font-medium text-[var(--pv-muted)]">Gerente</p>
            </div>
          </div>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <DeltaBadge change={change} />
          <ChevronRight size={18} className="text-[var(--pv-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--pv-terracotta)]" />
        </div>
      </div>

      {unit.collaboratorsAtRisk > 0 ? (
        <p className="mt-3 rounded-lg bg-[var(--pv-danger-bg)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--pv-danger)]">
          {unit.collaboratorsAtRisk} colaborador{unit.collaboratorsAtRisk > 1 ? 'es' : ''} pedindo atenção
        </p>
      ) : null}
    </Link>
  )
}

function HealthRing({ score, color, label }: { score: number; color: string; label: string }) {
  const size = 62
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EDE8DA" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-display text-base text-[var(--pv-ink)]">
          {score}
        </span>
      </div>
      <span className="mt-1 text-[10px] font-bold uppercase" style={{ color }}>
        {label}
      </span>
    </div>
  )
}
