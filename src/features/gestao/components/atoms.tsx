import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DATA_SOURCE_NAME, PERIOD_OPTIONS } from '../constants'
import type { RiskLevel } from '../metrics'
import type { PeriodKey } from '../types'

/** Container padrão dos blocos do painel (superfície clara sobre o fundo navy). */
export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl sm:p-6', className)}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-[var(--pv-ink)]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs font-medium text-[var(--pv-muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export function SectionLink({ to, label, dark = false }: { to: string; label: string; dark?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-1 text-sm font-semibold',
        dark ? 'text-[var(--pv-cream)] hover:text-white' : 'text-[var(--pv-terracotta)] hover:underline',
      )}
    >
      {label} <ArrowRight size={14} />
    </Link>
  )
}

/**
 * Variação percentual vs. período anterior.
 * `invert` indica que subir é ruim (ex.: faltas) — aí a cor vermelha fica para aumento.
 */
export function DeltaBadge({ change, invert = true, className }: { change: number | null; invert?: boolean; className?: string }) {
  if (change === null) {
    return <span className={cn('text-[11px] font-bold text-[#A9A493]', className)}>novo</span>
  }
  const isUp = change > 0
  const isBad = invert ? isUp : change < 0
  const Icon = change === 0 ? Minus : isUp ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold',
        change === 0
          ? 'bg-[#EDE8DA] text-[var(--pv-muted)]'
          : isBad
            ? 'bg-[var(--pv-danger-bg)] text-[var(--pv-danger)]'
            : 'bg-[var(--pv-success-bg)] text-[var(--pv-success)]',
        className,
      )}
    >
      <Icon size={12} strokeWidth={2.5} />
      {Math.abs(change)}%
    </span>
  )
}

const RISK_META: Record<RiskLevel, { label: string; className: string }> = {
  ok: { label: 'Regular', className: 'bg-[var(--pv-success-bg)] text-[var(--pv-success)]' },
  atencao: { label: 'Atenção', className: 'bg-[#FBF1DC] text-[#A6791F]' },
  critico: { label: 'Crítico', className: 'bg-[var(--pv-danger-bg)] text-[var(--pv-danger)]' },
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const meta = RISK_META[level]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold', meta.className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  )
}

/** Avatar com iniciais e cor estável derivada do nome. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
  const palette = ['#1B2A57', '#E15B3F', '#3B6EA5', '#2F7D4F', '#7A3E8E', '#C94A32', '#24356E']
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: palette[hash % palette.length], fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

export function SyncBadge({ syncedAt }: { syncedAt: string }) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(syncedAt).getTime()) / 60_000))
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-[var(--pv-cream)]/80">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ADE80] opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ADE80]" />
      </span>
      {DATA_SOURCE_NAME} · sincronizado há {minutes} min
      <RefreshCw size={12} className="opacity-60" />
    </span>
  )
}

export function PeriodSelect({ value, onChange }: { value: PeriodKey; onChange: (value: PeriodKey) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1" role="tablist" aria-label="Período">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-bold transition',
            value === option.value
              ? 'bg-[var(--pv-cream)] text-[var(--pv-navy)] shadow'
              : 'text-[var(--pv-cream)]/70 hover:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function ChartLegend({ items }: { items: Array<{ key: string; label: string; color: string }> }) {
  return (
    <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--pv-muted)]">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

/** Barra horizontal segmentada (ex.: distribuição de pontualidade). */
export function SegmentedBar({
  segments,
  height = 8,
}: {
  segments: Array<{ key: string; value: number; color: string; label: string }>
  height?: number
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-[#EDE8DA]" style={{ height }}>
      {segments.map((s) =>
        s.value > 0 ? (
          <div
            key={s.key}
            title={`${s.label}: ${total ? Math.round((s.value / total) * 100) : 0}%`}
            className="h-full transition-all duration-700"
            style={{ width: `${total ? (s.value / total) * 100 : 0}%`, background: s.color }}
          />
        ) : null,
      )}
    </div>
  )
}
