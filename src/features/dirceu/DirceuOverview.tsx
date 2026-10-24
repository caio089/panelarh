import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Store } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { formatRangeLabel, moveAnchor, todayInFortaleza, type DirceuPeriod } from './day'
import { DirceuReportView } from './DirceuReports'
import { DIRCEU_CATEGORIES } from './types'
import { useDirceuReport } from './useDirceuReport'

export function DirceuOverview({ paramPrefix = '', unit = 'dirceu', unitName = 'Dirceu' }: { paramPrefix?: string; unit?: string; unitName?: string }) {
  const { day, setDay, period, setPeriod, bounds, category, setCategory, data, error, loading, retry } = useDirceuReport(paramPrefix, unit)
  const today = todayInFortaleza()
  const report =
    category && data && data.category === category && data.period === period && data.start === bounds.start && data.end === bounds.end
      ? data
      : null
  const titles: Record<DirceuPeriod, string> = {
    dia: 'O dia da casa',
    semana: 'A semana da casa',
    mes: 'O mês da casa',
  }

  function go(delta: number) {
    const next = moveAnchor(day, period, delta)
    if (next > today) return
    setDay(next)
  }

  return (
    <section className="overflow-hidden rounded-[28px] bg-[var(--pv-surface)] shadow-xl">
      <header className="relative bg-[#0A1228] px-5 py-5 text-[#F7F4EC] sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[var(--pv-terracotta)]/30 blur-3xl" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--pv-cream)]/70">
              <Store size={13} /> Unidade {unitName}
            </p>
            <h2 className="mt-1 font-display text-3xl">{titles[period]}</h2>
            <p className="mt-1 text-sm text-[var(--pv-cream)]/75">
              {formatRangeLabel(bounds.start, bounds.end)}. Só a categoria escolhida entra na consulta.
            </p>
          </div>
          <DaySwitcher
            day={day}
            today={today}
            period={period}
            rangeLabel={formatRangeLabel(bounds.start, bounds.end)}
            canGoForward={moveAnchor(day, period, 1) <= today}
            onDay={setDay}
            onShift={go}
            onPeriod={setPeriod}
          />
        </div>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
        <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Relatórios da Saipos">
          {DIRCEU_CATEGORIES.map((item) => {
            const selected = category === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(item.id)}
                className={cn(
                  'rounded-2xl border px-4 py-3 text-left transition',
                  selected
                    ? 'border-[#0A1228] bg-[#0A1228] text-[#F7F4EC]'
                    : 'border-[var(--pv-line)] bg-white hover:border-[#0A1228]/30',
                )}
              >
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className={cn('mt-0.5 block text-xs', selected ? 'text-white/70' : 'text-[var(--pv-ink)]/60')}>
                  {item.hint}
                </span>
              </button>
            )
          })}
        </nav>

        {!category ? (
          <p className="rounded-2xl border border-dashed border-[var(--pv-line)] px-4 py-8 text-center text-sm text-[var(--pv-ink)]/65">
            Cozinha, faturamento, itens, entregas ou financeiro. O clique carrega só o período selecionado.
          </p>
        ) : null}
        {category && loading && !report ? <ReportSkeleton /> : null}
        {category && error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--pv-danger-bg)] px-4 py-3 text-sm">
            <p>{error}</p>
            <Button type="button" variant="outline" onClick={retry}>
              <RefreshCw size={14} /> Tentar de novo
            </Button>
          </div>
        ) : null}
        {report ? <DirceuReportView payload={report} /> : null}
        {period === 'dia' && category ? (
          <p className="text-sm text-[var(--pv-ink)]/65" aria-live="polite">
            {loading && report ? 'Atualizando os números.' : 'Este dia atualiza sozinho a cada 10 minutos.'}
            {report?.partial ? ' Os números ainda estão entrando.' : ''}
          </p>
        ) : report?.partial ? (
          <p className="text-sm text-[var(--pv-ink)]/65" aria-live="polite">
            Os números ainda estão entrando.
          </p>
        ) : null}
      </div>
    </section>
  )
}

const PERIODS: { id: DirceuPeriod; label: string }[] = [
  { id: 'dia', label: 'Dia' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mês' },
]

function DaySwitcher({
  day,
  today,
  period,
  rangeLabel,
  canGoForward,
  onDay,
  onShift,
  onPeriod,
}: {
  day: string
  today: string
  period: DirceuPeriod
  rangeLabel: string
  canGoForward: boolean
  onDay: (day: string) => void
  onShift: (delta: number) => void
  onPeriod: (period: DirceuPeriod) => void
}) {
  const previousLabel = period === 'mes' ? 'Mês anterior' : period === 'semana' ? 'Semana anterior' : 'Dia anterior'
  const nextLabel = period === 'mes' ? 'Próximo mês' : period === 'semana' ? 'Próxima semana' : 'Próximo dia'
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex rounded-xl bg-white/10 p-1" role="group" aria-label="Período do resumo">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={period === item.id}
            onClick={() => onPeriod(item.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-semibold',
              period === item.id ? 'bg-white text-[#0A1228]' : 'text-white/80 hover:text-white',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-label={previousLabel}
        onClick={() => onShift(-1)}
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
      >
        <ChevronLeft size={18} />
      </button>
      <label className="flex h-11 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm">
        <CalendarDays size={15} />
        <span className="hidden sm:inline">{rangeLabel}</span>
        <input
          type="date"
          value={day}
          max={today}
          onChange={(event) => onDay(event.target.value)}
          className="bg-transparent text-white outline-none [color-scheme:dark]"
        />
      </label>
      <button
        type="button"
        aria-label={nextLabel}
        disabled={!canGoForward}
        onClick={() => onShift(1)}
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15 disabled:opacity-30"
      >
        <ChevronRight size={18} />
      </button>
      {day !== today ? (
        <button
          type="button"
          onClick={() => onDay(today)}
          className="h-11 rounded-xl bg-white px-3 text-sm font-semibold text-[#0A1228]"
        >
          Hoje
        </button>
      ) : null}
      </div>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Carregando relatório">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-2xl bg-[var(--pv-line)]/70" />
      ))}
    </div>
  )
}
