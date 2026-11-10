import { AlertTriangle, CalendarDays, CalendarRange, Clock3, RefreshCw, Store, Truck, Trophy, UtensilsCrossed } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import { competitionDayInFortaleza, isIsoDate, todayInFortaleza } from '@/features/dirceu/day'

type UnitScore = {
  name: string
  orders: number
  kitchenMinutes: number | null
  accent: string
}

type CompetitionPeriod = 'dia' | 'mes'
type CompetitionView = 'placar' | 'ranking'
type CompetitionScore = { name: string; salesPoints: number; kitchenPoints: number; total: number }

type MonthlyRankingPayload = {
  standings?: CompetitionScore[]
  kitchenUnits?: Array<{ name: string; kitchenMinutes: number | null }>
}

type KdsOrder = {
  code: string
  channel: 'delivery' | 'mesa' | 'outros'
  status: string
  enteredAt: string | null
  waitingMinutes: number | null
  urgent: boolean
}

type KdsPayload = {
  unit: string
  fetchedAt: string
  active: number
  preparing: number
  waiting: number
  onTheWay: number
  urgent: number
  urgentAfterMinutes: number
  queue: KdsOrder[]
  stale?: boolean
  warning?: string
}

const ACCENTS: Record<string, string> = { Dirceu: '#F4B942', Promorar: '#E15B3F', Mocambinho: '#80C997' }
const TV_UNITS: Record<string, string> = { dirceu: 'Dirceu', promorar: 'Promorar', mocambinho: 'Mocambinho' }
const REFRESH_MS = 60 * 1000
const KDS_REFRESH_MS = 30 * 1000
const KDS_RETRY_MS = 2 * 60 * 1000
const PREPARE_REFRESH_MS = 40 * 1000
const AUTO_SLIDE_MS = 60 * 1000
const DAILY_RESULT_HOUR = 23
const DAILY_RESULT_MINUTE = 40

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
  return minutes >= 17 * 60 + 30 && minutes < DAILY_RESULT_HOUR * 60 + DAILY_RESULT_MINUTE
}

function pointsForPosition(position: number) {
  if (position === 1) return 3
  if (position === 2) return 2
  return 0
}

export function TvCompetitionPage() {
  const { unit: requestedUnit } = useParams()
  const { pathname } = useLocation()
  const [params, setParams] = useSearchParams()
  const routeUnit = requestedUnit || pathname.split('/').filter(Boolean)[0] || ''
  const tvUnitId = TV_UNITS[routeUnit] ? routeUnit : null
  const today = todayInFortaleza()
  const currentCompetitionDay = competitionDayInFortaleza()
  const rawDate = params.get('dia')
  const rawPeriod = params.get('periodo')
  const view: CompetitionView = params.get('aba') === 'ranking' ? 'ranking' : 'placar'
  const period: CompetitionPeriod = rawPeriod === 'mes' ? 'mes' : 'dia'
  const selectedDate = isIsoDate(rawDate) && rawDate <= today ? rawDate : currentCompetitionDay
  // O placar mensal sempre representa o mês calendário atual; somente o
  // placar diário pode consultar uma data anterior.
  const date = period === 'mes' ? today : selectedDate
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const [unitsByPeriod, setUnitsByPeriod] = useState<Record<CompetitionPeriod, UnitScore[]>>({ dia: [], mes: [] })
  const [monthlyScores, setMonthlyScores] = useState<CompetitionScore[]>([])
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [automaticRefresh, setAutomaticRefresh] = useState(() => isNightServiceWindow())
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
        const response = await fetch(period === 'mes'
          ? `/api/competition?dia=${date}&modo=diario`
          : `/api/competition?dia=${date}&periodo=dia&dados=cozinha`)
        const payload = (await response.json()) as MonthlyRankingPayload & { units?: Omit<UnitScore, 'accent'>[] }
        const kitchenUnits = period === 'mes' ? payload.kitchenUnits : payload.units
        if (!response.ok || !kitchenUnits || !alive) return
        const kitchens = new Map(kitchenUnits.map((unit) => [unit.name, unit.kitchenMinutes]))
        setUnitsByPeriod((current) => ({ ...current, [period]: current[period].map((unit) => ({ ...unit, kitchenMinutes: kitchens.get(unit.name) ?? null })) }))
        if (period === 'mes' && payload.standings) setMonthlyScores(payload.standings)
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
      const kitchenRequest = fetch(`/api/competition?dia=${date}&modo=diario`)
        .then(async (response) => {
          if (!response.ok) return null
          return await response.json() as MonthlyRankingPayload
        })
        .catch(() => null)

      try {
        const salesResponse = await fetch(`/api/competition?dia=${date}&periodo=mes`)
        const salesPayload = (await salesResponse.json()) as { units?: Omit<UnitScore, 'accent'>[] }
        if (!salesResponse.ok || !salesPayload.units) throw new Error('Não foi possível carregar o placar mensal.')
        if (!alive) return

        // Publica as vendas assim que elas chegam. O consolidado mensal da
        // cozinha é mais demorado e não pode impedir a troca da TV para o mês.
        setUnitsByPeriod((current) => ({
          ...current,
          mes: salesPayload.units!.map((unit) => ({
            ...unit,
            kitchenMinutes: null,
            accent: ACCENTS[unit.name] ?? '#EFE3C4',
          })),
        }))

        const kitchenPayload = await kitchenRequest
        if (!alive || !kitchenPayload?.kitchenUnits) return
        const kitchens = new Map(kitchenPayload.kitchenUnits.map((unit) => [unit.name, unit.kitchenMinutes]))
        setUnitsByPeriod((current) => ({
          ...current,
          mes: current.mes.map((unit) => ({ ...unit, kitchenMinutes: kitchens.get(unit.name) ?? null })),
        }))
        if (kitchenPayload.standings) setMonthlyScores(kitchenPayload.standings)
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
      if (next === 'ranking') updated.set('aba', 'ranking')
      else updated.delete('aba')
      return updated
    }, { replace: true })
  }

  const salesRanking = [...units].sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name))
  const kitchenRanking = [...units].sort((a, b) => (a.kitchenMinutes ?? Infinity) - (b.kitchenMinutes ?? Infinity) || a.name.localeCompare(b.name))
  const currentScores = salesRanking.map((unit) => {
    const salesIndex = salesRanking.findIndex((item) => item.name === unit.name)
    const kitchenIndex = kitchenRanking.findIndex((item) => item.name === unit.name)
    const salesPosition = rankingPosition(salesRanking, salesIndex, (item) => item.orders)
    const kitchenPosition = typeof unit.kitchenMinutes === 'number'
      ? rankingPosition(kitchenRanking, kitchenIndex, (item) => -(item.kitchenMinutes ?? Infinity))
      : 0
    const salesPoints = pointsForPosition(salesPosition)
    const kitchenPoints = pointsForPosition(kitchenPosition)
    return { name: unit.name, salesPoints, kitchenPoints, total: salesPoints + kitchenPoints }
  }).sort((a, b) => b.total - a.total || b.salesPoints - a.salesPoints || a.name.localeCompare(b.name))
  const scores = period === 'mes' ? monthlyScores : currentScores
  const periodLabel = period === 'mes' ? 'mês' : 'dia'
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

        {tvUnitId ? <TvUnitOperation unitId={tvUnitId} unitName={TV_UNITS[tvUnitId]} /> : null}

        <section className="flex flex-col justify-between gap-5 py-6 lg:flex-row lg:items-end lg:py-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E97A61] sm:text-sm">Desafio entre unidades</p>
            <h1 className="mt-2 font-display text-4xl leading-none sm:text-5xl lg:text-6xl">{view === 'ranking' ? `Ranking ${period === 'mes' ? 'mensal' : 'diário'}` : `Placar do ${periodLabel}`}</h1>
            <p className="mt-3 text-sm text-white/60 sm:text-base">{formatDate(updatedAt)} · Acumulado até {date.split('-').reverse().join('/')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
            <div className="flex overflow-hidden rounded-lg border border-white/10 text-xs font-bold">
              <button type="button" onClick={() => chooseView('placar')} className={`px-3 py-2 ${view === 'placar' ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/5 text-white/65'}`}>Placar</button>
              <button type="button" onClick={() => chooseView('ranking')} className={`px-3 py-2 ${view === 'ranking' ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/5 text-white/65'}`}>Ranking</button>
            </div>
            <div className="flex overflow-hidden rounded-lg border border-white/10 text-xs font-bold">
              <button type="button" onClick={() => choosePeriod('dia')} className={`px-3 py-2 ${period === 'dia' ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/5 text-white/65'}`}>{view === 'ranking' ? 'Diário' : 'Dia'}</button>
              <button type="button" onClick={() => choosePeriod('mes')} className={`px-3 py-2 ${period === 'mes' ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/5 text-white/65'}`}>{view === 'ranking' ? 'Mensal' : 'Mês'}</button>
            </div>
            {period === 'mes' ? <CalendarRange className="text-[#F4B942]" size={22} /> : <CalendarDays className="text-[#F4B942]" size={22} />}
            {period === 'dia' ? <label className="text-sm text-white/70">
              <span className="mr-2">Dia</span>
              <input type="date" value={date} max={today} onChange={(event) => chooseDate(event.target.value)} className="rounded-lg bg-white/10 px-2 py-1.5 text-white outline-none [color-scheme:dark]" />
            </label> : null}
            <button type="button" aria-label="Atualizar placar" onClick={() => setRefreshKey((value) => value + 1)} className="rounded-lg bg-white/10 p-2 text-[#EFE3C4] hover:bg-white/15">
              <RefreshCw size={17} />
            </button>
          </div>
        </section>

        {view === 'ranking' ? <CompetitionRankingPanel scores={scores} salesRanking={salesRanking} kitchenRanking={kitchenRanking} periodLabel={periodLabel} /> : (
          <section className="grid min-h-0 flex-1 gap-5 lg:grid-cols-2">
            <RankingCard
              title={period === 'mes' ? 'Vendas no mês' : 'Vendas em tempo real'}
              subtitle={`Ranking de vendas do ${periodLabel}`}
              icon={<Trophy size={24} />}
              units={salesRanking}
              showPoints={false}
              prominent
            />
            <RankingCard
              title={period === 'mes' ? 'Tempo médio no mês' : 'Tempo médio em tempo real'}
              subtitle={`Ranking de rapidez do ${periodLabel}`}
              icon={<Clock3 size={24} />}
              units={kitchenRanking}
              type="kitchen"
              showPoints={false}
              prominent
            />
          </section>
        )}

        <footer className="flex items-center justify-between gap-4 pt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35 sm:text-xs">
          <span>Panela Velha · competição interna</span>
          <span className="text-right">{error || (view === 'ranking' ? 'Ranking mensal e diário por pontuação' : automaticRefresh && period === 'dia' && date === currentCompetitionDay ? 'Atualização automática · Dia e Mês alternam a cada 1 min' : 'Dia e Mês alternam a cada 1 min')}</span>
        </footer>
      </div>
    </main>
  )
}

function TvUnitOperation({ unitId, unitName }: { unitId: string; unitName: string }) {
  const [data, setData] = useState<KdsPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    let timer: number | undefined
    const load = async () => {
      let nextRefreshMs = KDS_REFRESH_MS
      setLoading(true)
      try {
        const response = await fetch(`/api/kds?unidade=${unitId}`, {
          cache: 'no-store',
        })
        const payload = (await response.json()) as KdsPayload & { error?: string }
        if (!response.ok) throw Object.assign(new Error(payload.error || 'Não foi possível atualizar o KDS.'), { status: response.status })
        if (!alive) return
        setData(payload)
        setError('')
        if (payload.stale) nextRefreshMs = KDS_RETRY_MS
      } catch (reason) {
        if (!alive) return
        const status = reason instanceof Error && 'status' in reason ? Number(reason.status) : 0
        setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o KDS.')
        if (status === 503) nextRefreshMs = KDS_RETRY_MS
      } finally {
        if (alive) {
          setLoading(false)
          timer = window.setTimeout(() => { void load() }, nextRefreshMs)
        }
      }
    }
    void load()
    return () => {
      alive = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [unitId])

  const urgentOrders = data?.queue.filter((order) => order.urgent) ?? []
  const deliveryOrders = data?.queue.filter((order) => !order.urgent && order.channel === 'delivery') ?? []
  const tableOrders = data?.queue.filter((order) => !order.urgent && order.channel === 'mesa') ?? []

  return (
    <section className="mt-6 rounded-[28px] border border-white/10 bg-[#0D1731]/90 p-5 shadow-xl sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#80C997]"><Store size={17} /> Operação da unidade</p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl">Fila do KDS · {unitName}</h2>
          <p className="mt-2 text-sm text-white/55">Pedidos ainda não entregues após {data?.urgentAfterMinutes ?? 15} min aparecem em Urgentes · atualização a cada 30 s</p>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-[#E15B3F]/35 bg-[#E15B3F]/10 px-4 py-3 text-sm text-[#FFB3A6]">{error}</div> : null}
      {data ? (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <KdsColumn title="Delivery" orders={deliveryOrders} icon={<Truck size={20} />} />
            <KdsColumn title="Mesa" orders={tableOrders} icon={<UtensilsCrossed size={20} />} />
            <KdsColumn title="Urgentes" orders={urgentOrders} icon={<AlertTriangle size={20} />} urgent />
          </div>
          <p className={`mt-4 text-right text-[11px] font-semibold uppercase tracking-[0.12em] ${data.stale ? 'text-[#F4B942]' : 'text-white/35'}`}>{loading ? 'Atualizando Saipos…' : data.stale ? `Saipos instável · último dado válido ${formatKdsTime(data.fetchedAt)}` : `Atualizado ${formatKdsTime(data.fetchedAt)}`}</p>
        </>
      ) : loading ? <p className="mt-6 text-sm text-white/55">Buscando pedidos da {unitName}…</p> : null}
    </section>
  )
}

function KdsColumn({ title, orders, icon, urgent = false }: { title: string; orders: KdsOrder[]; icon: ReactNode; urgent?: boolean }) {
  return (
    <section className={`min-h-56 rounded-2xl border p-4 ${urgent ? 'border-[#E15B3F]/45 bg-[#E15B3F]/8' : 'border-white/10 bg-white/[0.04]'}`}>
      <div className={`flex items-center justify-between border-b pb-3 ${urgent ? 'border-[#E15B3F]/30 text-[#FF8E78]' : 'border-white/10 text-[#EFE3C4]'}`}>
        <div className="flex items-center gap-2">{icon}<h3 className="font-display text-2xl">{title}</h3></div>
        <span className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-extrabold ${urgent ? 'bg-[#E15B3F] text-white' : 'bg-white/10 text-white/70'}`}>{orders.length}</span>
      </div>
      {orders.length === 0 ? <p className="py-10 text-center text-sm text-white/40">Nenhum pedido</p> : (
        <ol className="mt-3 space-y-3">
          {orders.map((order, index) => <li key={`${order.code}-${index}`} className={`rounded-xl border px-4 py-3 ${urgent ? 'border-[#E15B3F]/45 bg-[#E15B3F]/12' : 'border-white/10 bg-[#090E20]/65'}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Pedido {order.code}</span>
              <strong className={`font-display text-2xl tabular-nums ${urgent ? 'text-[#FF8E78]' : 'text-[#F4B942]'}`}>{typeof order.waitingMinutes === 'number' ? `${order.waitingMinutes} min` : '—'}</strong>
            </div>
            <p className="mt-1 text-sm text-white/65">{kdsStatusLabel(order.status)}</p>
          </li>)}
        </ol>
      )}
    </section>
  )
}

function kdsStatusLabel(status: string) {
  if (status === 'Cozinha') return 'Em preparo'
  if (status === 'Aguardando Entrega') return 'Pronto para sair'
  if (status === 'Saiu para entrega') return 'Em entrega'
  return status
}

function formatKdsTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'agora' : new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
}

function CompetitionRankingPanel({ scores, salesRanking, kitchenRanking, periodLabel }: { scores: CompetitionScore[]; salesRanking: UnitScore[]; kitchenRanking: UnitScore[]; periodLabel: string }) {
  return (
    <section className="mt-1 min-h-0 flex-1">
      <article className="rounded-[28px] border border-[#F4B942]/35 bg-gradient-to-br from-[#303060] via-[#182658] to-[#101a3a] p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-5">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F4B942]">Classificação geral</p><h2 className="mt-1 font-display text-3xl">Ranking do {periodLabel}</h2></div>
          <Trophy className="text-[#F4B942]" size={42} />
        </div>
        <ol className="mt-3 divide-y divide-white/12">
          {scores.length === 0 ? <li className="py-8 text-center text-sm text-white/55">Calculando a soma dos pontos conquistados em cada dia…</li> : scores.map((unit, index) => {
            const position = rankingPosition(scores, index, (item) => item.total)
            return <li key={unit.name} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 py-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full font-extrabold ${position === 1 ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/10 text-white/70'}`}>{position}</span>
              <div><p className="font-display text-2xl">{unit.name}</p><p className="mt-1 text-xs text-white/55">{unit.salesPoints} pts em vendas · {unit.kitchenPoints} pts em rapidez</p></div>
              <strong className="font-display text-3xl text-[#F4B942]">{unit.total} pts</strong>
            </li>
          })}
        </ol>
      </article>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <RankingCard title={`Vendas do ${periodLabel}`} subtitle="Quantidade por unidade" icon={<Trophy size={20} />} units={salesRanking} />
        <RankingCard title={`Rapidez no ${periodLabel}`} subtitle="Tempo médio de preparo" icon={<Clock3 size={20} />} units={kitchenRanking} type="kitchen" />
      </div>
    </section>
  )
}

function RankingCard({ title, subtitle, icon, units, type = 'sales', showPoints = true, prominent = false }: { title: string; subtitle: string; icon: ReactNode; units: UnitScore[]; type?: 'sales' | 'kitchen'; showPoints?: boolean; prominent?: boolean }) {
  const maxOrders = Math.max(1, ...units.map((unit) => unit.orders))
  const fastestKitchen = units.find((unit) => typeof unit.kitchenMinutes === 'number')?.kitchenMinutes ?? 0
  return (
    <article className={`rounded-[28px] border border-white/10 bg-[#0D1731]/80 shadow-xl backdrop-blur ${prominent ? 'p-5 sm:p-7' : 'p-4 sm:p-5'}`}>
      <div className={`flex items-center justify-between gap-3 border-b border-white/10 ${prominent ? 'pb-5' : 'pb-4'}`}>
        <div><h2 className={`font-display ${prominent ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>{title}</h2><p className={`mt-1 text-white/50 ${prominent ? 'text-sm' : 'text-xs'}`}>{subtitle}</p></div>
        <span className={`rounded-xl bg-white/8 text-[#EFE3C4] ${prominent ? 'p-3.5' : 'p-2.5'}`}>{icon}</span>
      </div>
      <ol className="mt-2 divide-y divide-white/8">
        {units.map((unit, index) => {
          const value = type === 'sales' ? `${unit.orders} vendas` : typeof unit.kitchenMinutes !== 'number' ? '—' : `${unit.kitchenMinutes.toLocaleString('pt-BR')} min`
          const width = type === 'sales' ? (unit.orders / maxOrders) * 100 : unit.kitchenMinutes ? (fastestKitchen / unit.kitchenMinutes) * 100 : 0
          const position = type === 'sales'
            ? rankingPosition(units, index, (item) => item.orders)
            : rankingPosition(units, index, (item) => -(item.kitchenMinutes ?? Infinity))
          const points = typeof unit.kitchenMinutes === 'number' || type === 'sales' ? pointsForPosition(position) : 0
          const hasPosition = type === 'sales' || typeof unit.kitchenMinutes === 'number'
          return <li key={unit.name} className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-3 ${prominent ? 'py-5' : 'py-3'}`}>
            <span className={`flex items-center justify-center rounded-full font-extrabold ${prominent ? 'h-10 w-10 text-lg' : 'h-7 w-7 text-sm'} ${hasPosition && position === 1 ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/8 text-white/65'}`}>{hasPosition ? position : '—'}</span>
            <div className="min-w-0"><div className="flex justify-between gap-2"><p className={`truncate font-bold ${prominent ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'}`}>{unit.name}</p><span className="text-xs text-white/45">{type === 'sales' ? `${unit.orders} vendas` : 'preparo'}</span></div><div className={`mt-2 overflow-hidden rounded-full bg-white/10 ${prominent ? 'h-2' : 'h-1.5'}`}><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: unit.accent }} /></div></div>
            <div className="text-right"><strong className={`block font-display text-[#F9F6EC] ${prominent ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'}`}>{value}</strong>{showPoints ? <span className="text-xs font-extrabold text-[#F4B942]">+{points} pts</span> : null}</div>
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
