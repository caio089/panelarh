import { CalendarDays, Clock3, Crown, RefreshCw, Trophy, UtensilsCrossed } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isIsoDate, todayInFortaleza } from '@/features/dirceu/day'

type UnitScore = {
  name: string
  sales: number
  orders: number
  kitchenMinutes: number | null
  accent: string
}

const ACCENTS: Record<string, string> = { Dirceu: '#F4B942', Promorar: '#E15B3F', Mocambinho: '#80C997' }
const REFRESH_MS = 60 * 1000

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function isNightServiceWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  const minutes = hour * 60 + minute
  return minutes >= 17 * 60 + 30 || minutes <= 2 * 60 + 30
}

export function TvCompetitionPage() {
  const [params, setParams] = useSearchParams()
  const today = todayInFortaleza()
  const rawDate = params.get('dia')
  const date = isIsoDate(rawDate) && rawDate <= today ? rawDate : today
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [units, setUnits] = useState<UnitScore[]>([])
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [automaticRefresh, setAutomaticRefresh] = useState(() => isNightServiceWindow())

  useEffect(() => {
    const updateSchedule = () => setAutomaticRefresh(isNightServiceWindow())
    updateSchedule()
    const interval = window.setInterval(updateSchedule, REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const response = await fetch(`/api/competition?dia=${date}`)
        const payload = (await response.json()) as { error?: string; fetchedAt?: string; units?: Omit<UnitScore, 'accent'>[] }
        if (!response.ok || !payload.units) throw new Error(payload.error || 'Não foi possível atualizar o placar.')
        if (!alive) return
        setUnits(payload.units.map((unit) => ({ ...unit, accent: ACCENTS[unit.name] ?? '#EFE3C4' })))
        setUpdatedAt(payload.fetchedAt ? new Date(payload.fetchedAt) : new Date())
        setError('')
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o placar.')
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [date, refreshKey])

  useEffect(() => {
    if (!automaticRefresh || date !== today) return
    const interval = window.setInterval(() => setRefreshKey((value) => value + 1), REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [automaticRefresh, date, today])

  function chooseDate(next: string) {
    if (!isIsoDate(next) || next > today) return
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set('dia', next)
      return updated
    }, { replace: true })
  }

  const revenueRanking = [...units].sort((a, b) => b.sales - a.sales)
  const kitchenRanking = [...units].sort((a, b) => (a.kitchenMinutes ?? Infinity) - (b.kitchenMinutes ?? Infinity))
  const leader = revenueRanking[0]
  const kitchenLeader = kitchenRanking.find((unit) => unit.kitchenMinutes !== null)

  return (
    <main className="min-h-screen overflow-hidden bg-[#071024] px-5 py-5 text-[#F9F6EC] sm:px-9 lg:px-12 lg:py-8">
      <div className="pointer-events-none fixed -left-32 top-20 h-[32rem] w-[32rem] rounded-full bg-[#3151A7]/25 blur-[140px]" />
      <div className="pointer-events-none fixed -right-24 -top-28 h-[28rem] w-[28rem] rounded-full bg-[#E15B3F]/20 blur-[130px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1800px] flex-col">
        <header className="flex items-center justify-between gap-5 border-b border-white/12 pb-5 lg:pb-7">
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="font-display text-2xl tracking-tight text-[#EFE3C4] sm:text-3xl">Panela Velha</span>
            <span className="hidden h-8 w-px bg-white/20 sm:block" />
            <p className="hidden text-sm font-bold uppercase tracking-[0.22em] text-[#EFE3C4]/80 sm:block">Liga Panela Velha</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#EFE3C4]/20 bg-white/5 px-3 py-2 text-xs font-semibold text-[#EFE3C4] sm:px-4 sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-[#6FE2A2] shadow-[0_0_12px_#6FE2A2]" />
            AO VIVO
          </div>
        </header>

        <section className="flex flex-col justify-between gap-5 py-6 lg:flex-row lg:items-end lg:py-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E97A61] sm:text-sm">Desafio entre unidades</p>
            <h1 className="mt-2 font-display text-4xl leading-none sm:text-5xl lg:text-6xl">Quem está no topo {date === today ? 'hoje' : 'neste dia'}?</h1>
            <p className="mt-3 text-sm text-white/60 sm:text-base">{formatDate(updatedAt)} · Acumulado de {date.split('-').reverse().join('/')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
            <CalendarDays className="text-[#F4B942]" size={22} />
            <label className="text-sm text-white/70">
              <span className="mr-2">Dia</span>
              <input type="date" value={date} max={today} onChange={(event) => chooseDate(event.target.value)} className="rounded-lg bg-white/10 px-2 py-1.5 text-white outline-none [color-scheme:dark]" />
            </label>
            <button type="button" aria-label="Atualizar placar" onClick={() => setRefreshKey((value) => value + 1)} className="rounded-lg bg-white/10 p-2 text-[#EFE3C4] hover:bg-white/15">
              <RefreshCw size={17} />
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="relative overflow-hidden rounded-[28px] border border-[#F4B942]/35 bg-gradient-to-br from-[#303060] via-[#182658] to-[#101a3a] p-5 shadow-2xl sm:p-7">
            <Crown className="absolute -right-4 -top-3 text-[#F4B942]/15" size={190} strokeWidth={1} />
            <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-[#F4B942]">Líder em vendas</p>
            <div className="relative mt-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl sm:text-5xl">{leader?.name ?? 'Atualizando'}</h2>
                <p className="mt-2 text-base text-white/65">{leader ? `${leader.orders} pedidos realizados` : 'Consultando as unidades'}</p>
              </div>
              <Trophy className="mb-1 shrink-0 text-[#F4B942]" size={52} />
            </div>
            <div className="relative mt-7 flex items-end justify-between gap-4 border-t border-white/15 pt-5">
              <p className="font-display text-3xl text-[#F4B942] sm:text-4xl">{leader ? money.format(leader.sales) : '—'}</p>
              <p className="text-right text-sm text-white/65">faturamento<br />do dia</p>
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 sm:p-7">
            <div className="flex items-center gap-2 text-[#80C997]"><UtensilsCrossed size={21} /><p className="text-xs font-bold uppercase tracking-[0.18em]">Cozinha mais rápida</p></div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl sm:text-5xl">{kitchenLeader?.name ?? 'Atualizando'}</h2>
                <p className="mt-2 text-base text-white/65">do pedido ao pronto</p>
              </div>
              <p className="font-display text-4xl text-[#80C997] sm:text-5xl">{kitchenLeader?.kitchenMinutes?.toLocaleString('pt-BR') ?? '—'}<span className="text-xl">{kitchenLeader ? ' min' : ''}</span></p>
            </div>
            <div className="mt-7 border-t border-white/12 pt-4 text-sm text-white/55"><Clock3 className="mr-1.5 inline" size={15} />Menor tempo médio de preparo hoje</div>
          </article>
        </section>

        <section className="mt-5 grid min-h-0 flex-1 gap-5 lg:grid-cols-2">
          <RankingCard title="Ranking de vendas" subtitle="Faturamento acumulado" icon={<Trophy size={20} />} units={revenueRanking} type="sales" />
          <RankingCard title="Velocidade da cozinha" subtitle="Menos minutos, melhor posição" icon={<Clock3 size={20} />} units={kitchenRanking} type="kitchen" />
        </section>

        <footer className="flex items-center justify-between gap-4 pt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35 sm:text-xs">
          <span>Panela Velha · competição interna</span>
          <span className="text-right">{error || (automaticRefresh && date === today ? 'Atualização automática a cada 1 min' : 'Atualização manual fora de 17h30–02h30')}</span>
        </footer>
      </div>
    </main>
  )
}

function RankingCard({ title, subtitle, icon, units, type }: { title: string; subtitle: string; icon: ReactNode; units: UnitScore[]; type: 'sales' | 'kitchen' }) {
  const maxSales = Math.max(1, ...units.map((unit) => unit.sales))
  return (
    <article className="rounded-[28px] border border-white/10 bg-[#0D1731]/80 p-4 shadow-xl backdrop-blur sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div><h2 className="font-display text-xl sm:text-2xl">{title}</h2><p className="mt-1 text-xs text-white/50">{subtitle}</p></div>
        <span className="rounded-xl bg-white/8 p-2.5 text-[#EFE3C4]">{icon}</span>
      </div>
      <ol className="mt-2 divide-y divide-white/8">
        {units.map((unit, index) => {
          const value = type === 'sales' ? money.format(unit.sales) : unit.kitchenMinutes === null ? '—' : `${unit.kitchenMinutes.toLocaleString('pt-BR')} min`
          const fastest = units.find((item) => item.kitchenMinutes !== null)?.kitchenMinutes ?? 0
          const width = type === 'sales' ? (unit.sales / maxSales) * 100 : unit.kitchenMinutes ? (fastest / unit.kitchenMinutes) * 100 : 0
          return <li key={unit.name} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold ${index === 0 ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/8 text-white/65'}`}>{index + 1}</span>
            <div className="min-w-0"><div className="flex justify-between gap-2"><p className="truncate text-sm font-bold sm:text-base">{unit.name}</p><span className="text-xs text-white/45">{type === 'sales' ? `${unit.orders} pedidos` : 'preparo'}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: unit.accent }} /></div></div>
            <strong className="font-display text-base text-[#F9F6EC] sm:text-lg">{value}</strong>
          </li>
        })}
      </ol>
    </article>
  )
}
