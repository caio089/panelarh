import { CalendarDays, CalendarRange, Clock3, Crown, RefreshCw, Trophy, UtensilsCrossed } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { competitionDayInFortaleza, isIsoDate, todayInFortaleza } from '@/features/dirceu/day'

type UnitScore = {
  name: string
  orders: number
  kitchenMinutes: number | null
  accent: string
}

type CompetitionPeriod = 'dia' | 'mes'
type CompetitionView = 'placar' | 'diario'

type DailyRanking = {
  days: Array<{ date: string; units: Array<{ id: string; name: string; orders: number }>; winners: string[] }>
  standings: Array<{ id: string; name: string; wins: number }>
}

const ACCENTS: Record<string, string> = { Dirceu: '#F4B942', Promorar: '#E15B3F', Mocambinho: '#80C997' }
const REFRESH_MS = 60 * 1000
const PREPARE_REFRESH_MS = 40 * 1000
const AUTO_SLIDE_MS = 18 * 1000

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
  const currentCompetitionDay = competitionDayInFortaleza()
  const rawDate = params.get('dia')
  const rawPeriod = params.get('periodo')
  const view: CompetitionView = params.get('aba') === 'diario' ? 'diario' : 'placar'
  const period: CompetitionPeriod = rawPeriod === 'mes' ? 'mes' : 'dia'
  const selectedDate = isIsoDate(rawDate) && rawDate <= today ? rawDate : currentCompetitionDay
  // O placar mensal sempre representa o mês calendário atual; somente o
  // placar diário pode consultar uma data anterior.
  const date = period === 'mes' ? today : selectedDate
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [unitsByPeriod, setUnitsByPeriod] = useState<Record<CompetitionPeriod, UnitScore[]>>({ dia: [], mes: [] })
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [automaticRefresh, setAutomaticRefresh] = useState(() => isNightServiceWindow())
  const [dailyRanking, setDailyRanking] = useState<DailyRanking | null>(null)
  const [dailyLoading, setDailyLoading] = useState(false)
  const monthPrefetchDate = useRef<string | null>(null)
  const units = unitsByPeriod[period]

  useEffect(() => {
    const updateSchedule = () => setAutomaticRefresh(isNightServiceWindow())
    updateSchedule()
    const interval = window.setInterval(updateSchedule, REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (view !== 'placar') return
    const interval = window.setInterval(() => {
      setParams((current) => {
        const updated = new URLSearchParams(current)
        const currentPeriod = current.get('periodo') === 'mes' ? 'mes' : 'dia'
        if (currentPeriod === 'dia' && unitsByPeriod.mes.length === 0) return current
        updated.set('periodo', currentPeriod === 'mes' ? 'dia' : 'mes')
        return updated
      }, { replace: true })
    }, AUTO_SLIDE_MS)
    return () => window.clearInterval(interval)
  }, [setParams, unitsByPeriod.mes.length, view])

  useEffect(() => {
    if (view !== 'placar') return
    let alive = true
    async function load() {
      try {
        const response = await fetch(`/api/competition?dia=${date}&periodo=${period}`)
        const payload = (await response.json()) as { error?: string; fetchedAt?: string; units?: Omit<UnitScore, 'accent'>[] }
        if (!response.ok || !payload.units) throw new Error(payload.error || 'Não foi possível atualizar o placar.')
        if (!alive) return
        setUnitsByPeriod((current) => ({ ...current, [period]: payload.units!.map((unit) => ({ ...unit, kitchenMinutes: unit.kitchenMinutes ?? null, accent: ACCENTS[unit.name] ?? '#EFE3C4' })) }))
        setUpdatedAt(payload.fetchedAt ? new Date(payload.fetchedAt) : new Date())
        setError('')
        void loadKitchen()
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o placar.')
      }
    }

    async function loadKitchen() {
      try {
        const response = await fetch(`/api/competition?dia=${date}&periodo=${period}&dados=cozinha`)
        const payload = (await response.json()) as { units?: Omit<UnitScore, 'accent'>[] }
        if (!response.ok || !payload.units || !alive) return
        const kitchens = new Map(payload.units.map((unit) => [unit.name, unit.kitchenMinutes]))
        setUnitsByPeriod((current) => ({ ...current, [period]: current[period].map((unit) => ({ ...unit, kitchenMinutes: kitchens.get(unit.name) ?? null })) }))
      } catch {
        // O placar de vendas permanece disponível se a Saipos não responder a cozinha.
      }
    }

    void load()
    return () => {
      alive = false
    }
  }, [date, period, refreshKey, view])

  useEffect(() => {
    if (view !== 'placar' || period !== 'dia' || unitsByPeriod.mes.length > 0 || monthPrefetchDate.current === date) return
    monthPrefetchDate.current = date
    let alive = true
    async function prefetchMonth() {
      try {
        const [salesResponse, kitchenResponse] = await Promise.all([
          fetch(`/api/competition?dia=${date}&periodo=mes`),
          fetch(`/api/competition?dia=${date}&periodo=mes&dados=cozinha`),
        ])
        const salesPayload = (await salesResponse.json()) as { units?: Omit<UnitScore, 'accent'>[] }
        const kitchenPayload = kitchenResponse.ok ? await kitchenResponse.json() as { units?: Omit<UnitScore, 'accent'>[] } : null
        if (!salesResponse.ok || !salesPayload.units || !alive) return
        const kitchens = new Map(kitchenPayload?.units?.map((unit) => [unit.name, unit.kitchenMinutes]) ?? [])
        setUnitsByPeriod((current) => ({
          ...current,
          mes: salesPayload.units!.map((unit) => ({
            ...unit,
            kitchenMinutes: kitchens.get(unit.name) ?? null,
            accent: ACCENTS[unit.name] ?? '#EFE3C4',
          })),
        }))
      } catch {
        monthPrefetchDate.current = null
      }
    }
    void prefetchMonth()
    return () => { alive = false }
  }, [date, period, refreshKey, unitsByPeriod.mes.length, view])

  useEffect(() => {
    if (view !== 'placar' || !automaticRefresh || date !== currentCompetitionDay) return
    let alive = true
    let cycle = 0
    let dueCycle = -1
    const prepared = new Map<number, { sales?: UnitScore[]; kitchen?: Map<string, number | null>; fetchedAt?: Date }>()

    const publish = (preparedCycle: number) => {
      const next = prepared.get(preparedCycle)
      if (!next || !alive) return
      prepared.delete(preparedCycle)
      if (next.sales) {
        setUnitsByPeriod((current) => ({ ...current, dia: next.sales! }))
        setUpdatedAt(next.fetchedAt ?? new Date())
        setError('')
      }
      if (next.kitchen) {
        setUnitsByPeriod((current) => ({ ...current, dia: current.dia.map((unit) => ({ ...unit, kitchenMinutes: next.kitchen!.get(unit.name) ?? null })) }))
      }
    }

    const prepare = async (preparedCycle: number) => {
      const [salesResult, kitchenResult] = await Promise.allSettled([
        fetch(`/api/competition?dia=${date}&periodo=dia&atualiza=1`, { cache: 'no-store' }),
        fetch(`/api/competition?dia=${date}&periodo=dia&dados=cozinha&atualiza=1`, { cache: 'no-store' }),
      ])
      if (!alive || preparedCycle < dueCycle) return

      const next: { sales?: UnitScore[]; kitchen?: Map<string, number | null>; fetchedAt?: Date } = {}
      if (salesResult.status === 'fulfilled' && salesResult.value.ok) {
        const payload = (await salesResult.value.json()) as { fetchedAt?: string; units?: Omit<UnitScore, 'accent'>[] }
        if (payload.units) {
          next.sales = payload.units.map((unit) => ({ ...unit, kitchenMinutes: unit.kitchenMinutes ?? null, accent: ACCENTS[unit.name] ?? '#EFE3C4' }))
          next.fetchedAt = payload.fetchedAt ? new Date(payload.fetchedAt) : new Date()
        }
      }
      if (kitchenResult.status === 'fulfilled' && kitchenResult.value.ok) {
        const payload = (await kitchenResult.value.json()) as { units?: Omit<UnitScore, 'accent'>[] }
        if (payload.units) next.kitchen = new Map(payload.units.map((unit) => [unit.name, unit.kitchenMinutes]))
      }
      if (!next.sales && !next.kitchen) return
      prepared.set(preparedCycle, next)
      if (preparedCycle === dueCycle) publish(preparedCycle)
    }

    const beginPreparation = () => { void prepare(cycle) }
    const makeVisible = () => {
      dueCycle = cycle
      publish(cycle)
      cycle += 1
    }
    const prepareTimer = window.setTimeout(beginPreparation, PREPARE_REFRESH_MS)
    const publishTimer = window.setTimeout(makeVisible, REFRESH_MS)
    const prepareInterval = window.setInterval(beginPreparation, REFRESH_MS)
    const publishInterval = window.setInterval(makeVisible, REFRESH_MS)
    return () => {
      alive = false
      window.clearTimeout(prepareTimer)
      window.clearTimeout(publishTimer)
      window.clearInterval(prepareInterval)
      window.clearInterval(publishInterval)
    }
  }, [automaticRefresh, date, currentCompetitionDay, view])

  useEffect(() => {
    if (view !== 'diario') return
    const controller = new AbortController()
    async function loadDailyRanking() {
      setDailyLoading(true)
      try {
        const response = await fetch(`/api/competition?modo=diario${refreshKey ? '&atualiza=1' : ''}`, { signal: controller.signal })
        const payload = (await response.json()) as DailyRanking & { error?: string }
        if (!response.ok || !payload.days || !payload.standings) throw new Error(payload.error || 'Não foi possível carregar o ranking diário.')
        setDailyRanking(payload)
        setUpdatedAt(new Date())
        setError('')
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o ranking diário.')
      } finally {
        if (!controller.signal.aborted) setDailyLoading(false)
      }
    }
    void loadDailyRanking()
    return () => controller.abort()
  }, [view, refreshKey])

  function chooseDate(next: string) {
    if (!isIsoDate(next) || next > today) return
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set('dia', next)
      return updated
    }, { replace: true })
  }

  function choosePeriod(next: CompetitionPeriod) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set('periodo', next)
      return updated
    }, { replace: true })
  }

  function chooseView(next: CompetitionView) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      if (next === 'diario') updated.set('aba', 'diario')
      else updated.delete('aba')
      return updated
    }, { replace: true })
  }

  function chooseDailyDate(next: string) {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set('rankingDia', next)
      return updated
    }, { replace: true })
  }

  const salesRanking = [...units].sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name))
  const kitchenRanking = [...units].sort((a, b) => (a.kitchenMinutes ?? Infinity) - (b.kitchenMinutes ?? Infinity) || a.name.localeCompare(b.name))
  const leader = salesRanking[0]
  const kitchenLeader = kitchenRanking.find((unit) => typeof unit.kitchenMinutes === 'number')
  const periodLabel = period === 'mes' ? 'mês' : 'dia'
  const currentMonth = today.slice(0, 7)
  const requestedDailyDate = params.get('rankingDia')
  const dailySelectedDate = requestedDailyDate && requestedDailyDate.startsWith(currentMonth) && dailyRanking?.days.some((day) => day.date === requestedDailyDate)
    ? requestedDailyDate
    : dailyRanking?.days[dailyRanking.days.length - 1]?.date ?? today

  return (
    <main className="min-h-screen overflow-hidden bg-[#090E20] px-5 py-5 text-[#F9F6EC] sm:px-9 lg:px-12 lg:py-8">
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
            <h1 className="mt-2 font-display text-4xl leading-none sm:text-5xl lg:text-6xl">{view === 'diario' ? 'Ranking diário' : `Ranking do ${periodLabel}`}</h1>
            <p className="mt-3 text-sm text-white/60 sm:text-base">{formatDate(updatedAt)} · {view === 'diario' ? 'Vitórias por dia no mês atual' : `Acumulado até ${date.split('-').reverse().join('/')}`}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
            <div className="flex overflow-hidden rounded-lg border border-white/10 text-xs font-bold">
              <button type="button" onClick={() => chooseView('placar')} className={`px-3 py-2 ${view === 'placar' ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/5 text-white/65'}`}>Placar</button>
              <button type="button" onClick={() => chooseView('diario')} className={`px-3 py-2 ${view === 'diario' ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/5 text-white/65'}`}>Ranking diário</button>
            </div>
            {view === 'placar' ? <>
              <div className="flex overflow-hidden rounded-lg border border-white/10 text-xs font-bold">
                <button type="button" onClick={() => choosePeriod('dia')} className={`px-3 py-2 ${period === 'dia' ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/5 text-white/65'}`}>Dia</button>
                <button type="button" onClick={() => choosePeriod('mes')} className={`px-3 py-2 ${period === 'mes' ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/5 text-white/65'}`}>Mês</button>
              </div>
              {period === 'mes' ? <CalendarRange className="text-[#F4B942]" size={22} /> : <CalendarDays className="text-[#F4B942]" size={22} />}
              <label className="text-sm text-white/70">
                <span className="mr-2">Até</span>
                <input type="date" value={date} max={today} disabled={period === 'mes'} onChange={(event) => chooseDate(event.target.value)} className="rounded-lg bg-white/10 px-2 py-1.5 text-white outline-none disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]" />
              </label>
            </> : <span className="inline-flex items-center gap-2 text-sm text-white/70"><CalendarDays className="text-[#F4B942]" size={21} /> Mês atual</span>}
            <button type="button" aria-label="Atualizar placar" onClick={() => setRefreshKey((value) => value + 1)} className="rounded-lg bg-white/10 p-2 text-[#EFE3C4] hover:bg-white/15">
              <RefreshCw size={17} />
            </button>
          </div>
        </section>

        {view === 'diario' ? <DailyRankingPanel ranking={dailyRanking} selectedDate={dailySelectedDate} loading={dailyLoading} onSelectDate={chooseDailyDate} /> : <>
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="relative overflow-hidden rounded-[28px] border border-[#F4B942]/35 bg-gradient-to-br from-[#303060] via-[#182658] to-[#101a3a] p-5 shadow-2xl sm:p-7">
            <Crown className="absolute -right-4 -top-3 text-[#F4B942]/15" size={190} strokeWidth={1} />
            <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-[#F4B942]">Líder em vendas</p>
            <div className="relative mt-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl sm:text-5xl">{leader?.name ?? 'Atualizando'}</h2>
                <p className="mt-2 text-base text-white/65">{leader ? `${leader.orders} vendas realizadas` : 'Consultando as unidades'}</p>
              </div>
              <Trophy className="mb-1 shrink-0 text-[#F4B942]" size={52} />
            </div>
            <div className="relative mt-7 flex items-end justify-between gap-4 border-t border-white/15 pt-5">
              <p className="font-display text-3xl text-[#F4B942] sm:text-4xl">{leader ? `${leader.orders} vendas` : '—'}</p>
              <p className="text-right text-sm text-white/65">total<br />do {periodLabel}</p>
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
            <div className="mt-7 border-t border-white/12 pt-4 text-sm text-white/55"><Clock3 className="mr-1.5 inline" size={15} />Menor tempo médio de preparo no {periodLabel}</div>
          </article>
        </section>

        <section className="mt-5 grid min-h-0 flex-1 gap-5 lg:grid-cols-2">
          <RankingCard title={`Ranking de vendas do ${periodLabel}`} subtitle="Quantidade de vendas por unidade" icon={<Trophy size={20} />} units={salesRanking} />
          <RankingCard title={period === 'mes' ? 'Tempo médio mensal' : 'Velocidade da cozinha'} subtitle="Menos minutos, melhor posição" icon={<Clock3 size={20} />} units={kitchenRanking} type="kitchen" />
        </section>
        </>}

        <footer className="flex items-center justify-between gap-4 pt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35 sm:text-xs">
          <span>Panela Velha · competição interna</span>
          <span className="text-right">{error || (view === 'diario' ? 'Empate conta como vitória para as unidades empatadas' : automaticRefresh && period === 'dia' && date === currentCompetitionDay ? 'Atualização automática a cada 1 min · tela alterna Dia e Mês' : 'Tela alterna Dia e Mês automaticamente')}</span>
        </footer>
      </div>
    </main>
  )
}

function DailyRankingPanel({ ranking, selectedDate, loading, onSelectDate }: { ranking: DailyRanking | null; selectedDate: string; loading: boolean; onSelectDate: (date: string) => void }) {
  const selectedDay = ranking?.days.find((day) => day.date === selectedDate)
  const standings = [...(ranking?.standings ?? [])].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name))
  const days = [...(ranking?.days ?? [])].reverse()
  const displayDate = selectedDate ? selectedDate.split('-').reverse().join('/') : ''

  return (
    <section className="mt-1 grid min-h-0 flex-1 gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <article className="rounded-[28px] border border-[#F4B942]/35 bg-gradient-to-br from-[#303060] via-[#182658] to-[#101a3a] p-5 shadow-2xl sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F4B942]">Quem venceu mais dias</p>
        <div className="mt-5 space-y-4">
          {loading && !ranking ? <p className="text-white/65">Consultando as vendas do mês…</p> : standings.map((unit, index) => {
            const position = rankingPosition(standings, index, (item) => item.wins)
            return <div key={unit.id} className="flex items-center justify-between gap-4 border-b border-white/12 pb-4 last:border-0">
              <div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${position === 1 ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/10 text-white/70'}`}>{position}</span><p className="font-display text-2xl">{unit.name}</p></div>
              <strong className="font-display text-2xl text-[#F4B942]">{unit.wins} {unit.wins === 1 ? 'vitória' : 'vitórias'}</strong>
            </div>
          })}
        </div>
      </article>

      <article className="rounded-[28px] border border-white/10 bg-[#0D1731]/80 p-4 shadow-xl backdrop-blur sm:p-5">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4"><div><h2 className="font-display text-xl sm:text-2xl">Vencedores por dia</h2><p className="mt-1 text-xs text-white/50">Clique em um dia para ver o placar de cada unidade.</p></div><span className="rounded-xl bg-white/8 p-2.5 text-[#EFE3C4]"><CalendarDays size={20} /></span></div>
        <div className="mt-4 grid max-h-[24rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {days.map((day) => {
            const winners = day.units.filter((unit) => day.winners.includes(unit.id)).map((unit) => unit.name)
            const active = day.date === selectedDate
            return <button key={day.date} type="button" onClick={() => onSelectDate(day.date)} className={`rounded-xl border p-3 text-left transition ${active ? 'border-[#F4B942] bg-[#F4B942]/15' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'}`}>
              <p className="text-sm font-bold">{day.date.split('-').reverse().join('/')}</p>
              <p className="mt-1 text-xs text-white/60">{winners.length ? `Vencedor${winners.length > 1 ? 'es' : ''}: ${winners.join(' e ')}` : 'Sem vendas registradas'}</p>
            </button>
          })}
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#F4B942]">Placar de {displayDate}</p>
          {selectedDay ? <div className="mt-3 grid gap-2 sm:grid-cols-3">{[...selectedDay.units].sort((a, b) => b.orders - a.orders).map((unit) => <div key={unit.id} className="rounded-xl bg-white/[0.06] p-3"><p className="font-bold">{unit.name}</p><p className="mt-1 font-display text-xl">{unit.orders} vendas</p></div>)}</div> : <p className="mt-3 text-sm text-white/55">Nenhum dia disponível ainda.</p>}
        </div>
      </article>
    </section>
  )
}

function RankingCard({ title, subtitle, icon, units, type = 'sales' }: { title: string; subtitle: string; icon: ReactNode; units: UnitScore[]; type?: 'sales' | 'kitchen' }) {
  const maxOrders = Math.max(1, ...units.map((unit) => unit.orders))
  const fastestKitchen = units.find((unit) => typeof unit.kitchenMinutes === 'number')?.kitchenMinutes ?? 0
  return (
    <article className="rounded-[28px] border border-white/10 bg-[#0D1731]/80 p-4 shadow-xl backdrop-blur sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div><h2 className="font-display text-xl sm:text-2xl">{title}</h2><p className="mt-1 text-xs text-white/50">{subtitle}</p></div>
        <span className="rounded-xl bg-white/8 p-2.5 text-[#EFE3C4]">{icon}</span>
      </div>
      <ol className="mt-2 divide-y divide-white/8">
        {units.map((unit, index) => {
          const value = type === 'sales' ? `${unit.orders} vendas` : typeof unit.kitchenMinutes !== 'number' ? '—' : `${unit.kitchenMinutes.toLocaleString('pt-BR')} min`
          const width = type === 'sales' ? (unit.orders / maxOrders) * 100 : unit.kitchenMinutes ? (fastestKitchen / unit.kitchenMinutes) * 100 : 0
          const position = type === 'sales'
            ? rankingPosition(units, index, (item) => item.orders)
            : rankingPosition(units, index, (item) => -(item.kitchenMinutes ?? Infinity))
          return <li key={unit.name} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold ${position === 1 ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/8 text-white/65'}`}>{position}</span>
            <div className="min-w-0"><div className="flex justify-between gap-2"><p className="truncate text-sm font-bold sm:text-base">{unit.name}</p><span className="text-xs text-white/45">{type === 'sales' ? `${unit.orders} vendas` : 'preparo'}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: unit.accent }} /></div></div>
            <strong className="font-display text-base text-[#F9F6EC] sm:text-lg">{value}</strong>
          </li>
        })}
      </ol>
    </article>
  )
}

function rankingPosition<T>(items: T[], index: number, valueOf: (item: T) => number) {
  const current = valueOf(items[index])
  return items.findIndex((item) => valueOf(item) === current) + 1
}
