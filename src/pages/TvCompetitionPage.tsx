import { AlertTriangle, CalendarDays, CalendarRange, Clock3, RefreshCw, Store, Trophy } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { COMPETITION_UNIT_IDS, fetchCompetitionUnit, loadCompetitionUnits, type CompetitionDayPoint, type CompetitionFields, type CompetitionPeriod, type CompetitionUnitMetric } from '@/features/dirceu/competitionClient'
import { competitionDayInFortaleza, isIsoDate, todayInFortaleza } from '@/features/dirceu/day'

type UnitScore = {
  name: string
  orders: number | null
  kitchenMinutes: number | null
  accent: string
  ready: CompetitionFields
}

type CompetitionView = 'placar' | 'ranking'
type CompetitionScore = { name: string; salesPoints: number; kitchenPoints: number; total: number }
type CompetitionStatus = { error: string; pending: boolean; stale: boolean }
type CompetitionSnapshot = {
  date: string
  units: UnitScore[]
  updatedAt?: string
  status?: CompetitionStatus
}
type CompetitionBoard = Partial<Record<CompetitionPeriod, CompetitionSnapshot>>

type KdsOrder = {
  code: string
  channel: 'delivery' | 'mesa' | 'outros'
  label?: string
  reference?: string
  status: string
  enteredAt: string | null
  waitingMinutes: number | null
  urgent: boolean
}

type KdsPayload = {
  unit: string
  date: string
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
const EMPTY_UNITS: UnitScore[] = COMPETITION_UNIT_IDS.map((id) => ({
  name: TV_UNITS[id],
  orders: null,
  kitchenMinutes: null,
  accent: ACCENTS[TV_UNITS[id]],
  ready: { orders: false, kitchen: false },
}))

function unitSlug(value: string | undefined) {
  let raw = value || ''
  try {
    raw = decodeURIComponent(raw)
  } catch {
    raw = value || ''
  }
  const slug = raw.trim().toLowerCase()
  return TV_UNITS[slug] ? slug : null
}

/** Endereço canônico da TV. /tv/Mocambinho e /Mocambinho passam a abrir a mesma operação. */
export function canonicalTvPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part).trim().toLowerCase()
    } catch {
      return part.trim().toLowerCase()
    }
  })
  if (parts.length === 0) return null
  const last = parts[parts.length - 1]
  if (parts[0] === 'tv' || TV_UNITS[last]) return `/${parts.join('/')}`
  return null
}
const REFRESH_MS = 60 * 1000
const HISTORICAL_REFRESH_MS = 5 * REFRESH_MS
const KDS_REFRESH_MS = 30 * 1000
const KDS_RETRY_MS = 2 * 60 * 1000
const AUTO_SLIDE_MS = 60 * 1000
const COMPETITION_RETRY_MS = 20 * 1000

function useCompetitionDates() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [])
  return { today: todayInFortaleza(now), currentCompetitionDay: competitionDayInFortaleza(now) }
}

async function readJson<T>(response: Response): Promise<T> {
  const raw = await response.text()
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error('A consulta da TV não devolveu dados válidos.')
  }
}

function pointsForPosition(position: number) {
  if (position === 1) return 3
  if (position === 2) return 2
  return 0
}

function boardSnapshot(board: CompetitionBoard, period: CompetitionPeriod, date: string): CompetitionSnapshot {
  const snapshot = board[period]
  return snapshot?.date === date ? snapshot : { date, units: EMPTY_UNITS }
}

function mergeCompetitionUnit(snapshot: CompetitionSnapshot, unit: CompetitionUnitMetric, fields: CompetitionFields, fetchedAt?: string, stale = false) {
  let changed = false
  const units = snapshot.units.map((existing) => {
    if (existing.name !== TV_UNITS[unit.id]) return existing
    const orders = fields.orders && (!stale || !existing.ready.orders)
    const kitchen = fields.kitchen && (!stale || !existing.ready.kitchen)
    changed = orders || kitchen
    if (!changed) return existing
    return {
      ...existing,
      orders: orders ? unit.orders : existing.orders,
      kitchenMinutes: kitchen ? unit.kitchenMinutes : existing.kitchenMinutes,
      ready: { orders: orders || existing.ready.orders, kitchen: kitchen || existing.ready.kitchen },
    }
  })
  if (!changed) return snapshot
  const updatedAt = fetchedAt && (!snapshot.updatedAt || Date.parse(fetchedAt) > Date.parse(snapshot.updatedAt))
    ? fetchedAt
    : snapshot.updatedAt
  return { ...snapshot, units, updatedAt }
}

function statusMessage(snapshot: CompetitionSnapshot, period: CompetitionPeriod) {
  const status = snapshot.status
  if (!status) return 'Carregando indicadores…'
  const hasData = snapshot.units.some((unit) => unit.ready.orders || unit.ready.kitchen)
  if (status.error) return hasData ? 'Atualização indisponível em parte. Últimos dados disponíveis em exibição.' : status.error
  if (status.stale) return 'Atualização em andamento. Últimos dados disponíveis em exibição.'
  if (status.pending) return period === 'mes' ? 'Consolidando os dias do mês…' : 'Carregando indicadores do dia…'
  return ''
}

function standingsFromDays(series: Array<{ name: string; days: CompetitionDayPoint[] }>) {
  const totals = new Map(series.map((item) => [item.name, { name: item.name, salesPoints: 0, kitchenPoints: 0, total: 0 }]))
  const length = series[0]?.days.length ?? 0
  for (let index = 0; index < length; index += 1) {
    const units = series.map((item) => item.days[index])
    series.forEach((item, itemIndex) => {
      const unit = units[itemIndex]
      const salesPosition = 1 + units.filter((other) => other.orders > unit.orders).length
      const kitchenScore = (value: { kitchenMinutes: number | null }) => -(value.kitchenMinutes ?? Number.POSITIVE_INFINITY)
      const kitchenPosition = typeof unit.kitchenMinutes === 'number'
        ? 1 + units.filter((other) => kitchenScore(other) > kitchenScore(unit)).length
        : 0
      const standing = totals.get(item.name)
      if (!standing) return
      const salesPoints = unit.orders > 0 ? pointsForPosition(salesPosition) : 0
      const kitchenPoints = kitchenPosition ? pointsForPosition(kitchenPosition) : 0
      standing.salesPoints += salesPoints
      standing.kitchenPoints += kitchenPoints
      standing.total += salesPoints + kitchenPoints
    })
  }
  return [...totals.values()].sort((a, b) => b.total - a.total || b.salesPoints - a.salesPoints || a.name.localeCompare(b.name))
}

export function TvCompetitionPage() {
  const { unit: requestedUnit } = useParams()
  const { pathname } = useLocation()
  const routeUnit = requestedUnit || pathname.split('/').filter(Boolean).at(-1) || ''
  const tvUnitId = unitSlug(routeUnit)

  if (tvUnitId) return <TvUnitDashboard unitId={tvUnitId} unitName={TV_UNITS[tvUnitId]} />
  return <CompetitionDashboard />
}

function CompetitionDashboard() {
  const [params, setParams] = useSearchParams()
  const originUnit = params.get('origem')
  const operationPath = originUnit && TV_UNITS[originUnit] ? `/${originUnit}` : null
  const { today, currentCompetitionDay } = useCompetitionDates()
  const rawDate = params.get('dia')
  const rawPeriod = params.get('periodo')
  const view: CompetitionView = params.get('aba') === 'ranking' ? 'ranking' : 'placar'
  const period: CompetitionPeriod = rawPeriod === 'mes' ? 'mes' : 'dia'
  const selectedDate = isIsoDate(rawDate) && rawDate <= today ? rawDate : currentCompetitionDay
  // O placar mensal sempre representa o mês calendário atual; somente o
  // placar diário pode consultar uma data anterior.
  const date = period === 'mes' ? today : selectedDate
  const [board, setBoard] = useState<CompetitionBoard>({})
  const [monthlyRanking, setMonthlyRanking] = useState<{ date: string; scores: CompetitionScore[] }>()
  const [refreshKey, setRefreshKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const appliedRefresh = useRef(0)
  const snapshot = boardSnapshot(board, period, date)
  const units = snapshot.units
  const hasMonthlyData = boardSnapshot(board, 'mes', today).units.some((unit) => unit.ready.orders || unit.ready.kitchen)
  const unitOrder = useMemo(
    () => (originUnit && TV_UNITS[originUnit]
      ? [originUnit, ...COMPETITION_UNIT_IDS.filter((id) => id !== originUnit)]
      : [...COMPETITION_UNIT_IDS]),
    [originUnit],
  )

  useEffect(() => {
    if (view !== 'placar' || refreshing) return
    const interval = window.setInterval(() => {
      setParams((current) => {
        const updated = new URLSearchParams(current)
        const currentPeriod = current.get('periodo') === 'mes' ? 'mes' : 'dia'
        if (currentPeriod === 'dia' && !hasMonthlyData) return current
        updated.set('periodo', currentPeriod === 'mes' ? 'dia' : 'mes')
        return updated
      }, { replace: true })
    }, AUTO_SLIDE_MS)
    return () => window.clearInterval(interval)
  }, [setParams, hasMonthlyData, refreshing, view])

  useEffect(() => {
    const controller = new AbortController()
    const filled = new Set<CompetitionPeriod>()
    let timer: number | undefined
    let lastKitchen = 0
    let dailyKitchenStatus: CompetitionStatus = { pending: true, error: '', stale: false }
    const dateFor = (selected: CompetitionPeriod) => selected === 'mes' ? today : selectedDate

    function update(selected: CompetitionPeriod, apply: (snapshot: CompetitionSnapshot) => CompetitionSnapshot) {
      if (controller.signal.aborted) return
      setBoard((current) => ({
        ...current,
        [selected]: apply(boardSnapshot(current, selected, dateFor(selected))),
      }))
    }

    const loadPeriod = async (selected: CompetitionPeriod, fresh: boolean) => {
      const load = (kitchen: boolean) => loadCompetitionUnits({
        unitIds: unitOrder,
        date: dateFor(selected),
        period: selected,
        kitchen,
        fresh,
        signal: controller.signal,
        onUnit: (unit, fields, fetchedAt, stale) => update(selected, (current) => mergeCompetitionUnit(current, unit, fields, fetchedAt, stale)),
      })
      const sales = await load(false)
      if (selected === 'mes' || controller.signal.aborted) return sales
      if (fresh || Date.now() - lastKitchen >= 3 * REFRESH_MS || dailyKitchenStatus.stale || dailyKitchenStatus.error) {
        dailyKitchenStatus = await load(true)
        lastKitchen = Date.now()
      }
      return {
        pending: sales.pending || dailyKitchenStatus.pending,
        stale: sales.stale || dailyKitchenStatus.stale,
        error: sales.error || dailyKitchenStatus.error,
      }
    }

    const loadRanking = async (fresh: boolean): Promise<CompetitionStatus> => {
      let pending = false
      let stale = false
      let error = ''
      const series: Array<{ name: string; days: CompetitionDayPoint[] }> = []
      for (const unitId of unitOrder) {
        if (controller.signal.aborted) return { pending, stale, error }
        try {
          const payload = await fetchCompetitionUnit({ unitId, date: today, period: 'mes', daily: true, fresh, signal: controller.signal })
          const { unit, fields, days } = payload
          stale ||= Boolean(payload.stale)
          if (fields.orders || fields.kitchen) update('mes', (current) => mergeCompetitionUnit(current, unit, fields, payload.fetchedAt, payload.stale))
          if (payload.partial || !days) {
            pending = true
            continue
          }
          const sameMonth = days.length === Number(today.slice(-2)) && days.every(
            (day, index) => day.date === today.slice(0, 8) + String(index + 1).padStart(2, '0'),
          )
          if (!sameMonth || !fields.orders || !fields.kitchen) {
            error ||= 'A série de dias do ranking veio incompleta.'
            continue
          }
          series.push({ name: unit.name, days })
        } catch (reason) {
          error ||= reason instanceof Error ? reason.message : 'Não foi possível atualizar a classificação.'
        }
      }
      if (!controller.signal.aborted && series.length === unitOrder.length) {
        setMonthlyRanking((current) => stale && current?.date === today
          ? current
          : { date: today, scores: standingsFromDays(series) })
      }
      return { pending, stale, error }
    }

    const run = async () => {
      if (controller.signal.aborted) return
      const fresh = refreshKey !== appliedRefresh.current
      appliedRefresh.current = refreshKey
      let status: CompetitionStatus
      try {
        status = view === 'ranking' && period === 'mes' ? await loadRanking(fresh) : await loadPeriod(period, fresh)
      } finally {
        if (fresh) setRefreshing(false)
      }
      update(period, (current) => ({ ...current, status }))
      if (controller.signal.aborted) return
      let shouldRetry = status.pending || status.stale || Boolean(status.error)
      if (view === 'placar') {
        const other = period === 'dia' ? 'mes' : 'dia'
        if (!filled.has(other)) {
          const extra = await loadPeriod(other, false)
          update(other, (current) => ({ ...current, status: extra }))
          const retryOther = extra.pending || extra.stale || Boolean(extra.error)
          if (!retryOther) filled.add(other)
          shouldRetry ||= retryOther
        }
      }
      if (controller.signal.aborted) return
      const historical = period === 'dia' && selectedDate < currentCompetitionDay
      const refreshDelay = historical && !shouldRetry ? HISTORICAL_REFRESH_MS : REFRESH_MS
      timer = window.setTimeout(() => { void run() }, status.pending || status.stale ? COMPETITION_RETRY_MS : refreshDelay)
    }

    void run()
    return () => {
      controller.abort()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [currentCompetitionDay, selectedDate, today, period, refreshKey, unitOrder, view])

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

  const salesRanking = [...units].sort((a, b) => (b.orders ?? -1) - (a.orders ?? -1) || a.name.localeCompare(b.name))
  const kitchenRanking = [...units].sort((a, b) => (a.kitchenMinutes ?? Infinity) - (b.kitchenMinutes ?? Infinity) || a.name.localeCompare(b.name))
  const salesComplete = units.every((unit) => unit.ready.orders)
  const kitchenComplete = units.every((unit) => unit.ready.kitchen)
  const currentScores = (salesComplete && kitchenComplete ? salesRanking : []).map((unit) => {
    const salesIndex = salesRanking.findIndex((item) => item.name === unit.name)
    const kitchenIndex = kitchenRanking.findIndex((item) => item.name === unit.name)
    const salesPosition = rankingPosition(salesRanking, salesIndex, (item) => item.orders ?? -1)
    const kitchenPosition = typeof unit.kitchenMinutes === 'number'
      ? rankingPosition(kitchenRanking, kitchenIndex, (item) => -(item.kitchenMinutes ?? Infinity))
      : 0
    const salesPoints = (unit.orders ?? 0) > 0 ? pointsForPosition(salesPosition) : 0
    const kitchenPoints = pointsForPosition(kitchenPosition)
    return { name: unit.name, salesPoints, kitchenPoints, total: salesPoints + kitchenPoints }
  }).sort((a, b) => b.total - a.total || b.salesPoints - a.salesPoints || a.name.localeCompare(b.name))
  const scores = period === 'mes' ? (monthlyRanking?.date === today ? monthlyRanking.scores : []) : currentScores
  const status = statusMessage(snapshot, period)
  const complete = !refreshing && !status && salesComplete && kitchenComplete
  const live = complete && (period === 'mes' || selectedDate === currentCompetitionDay)
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
          <div className="flex items-center gap-2">
            {operationPath ? <Link to={operationPath} className="rounded-full border border-[#F4B942]/35 bg-[#F4B942]/10 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[#F4B942]">Operação</Link> : null}
            <div className="flex items-center gap-2 rounded-full border border-[#EFE3C4]/20 bg-white/5 px-3 py-2 text-xs font-semibold text-[#EFE3C4] sm:px-4 sm:text-sm">
              <span className={`h-2 w-2 rounded-full ${live ? 'bg-[#6FE2A2] shadow-[0_0_12px_#6FE2A2]' : 'bg-[#F4B942]'}`} />
              {live ? 'AO VIVO' : complete ? 'DADOS DO TURNO' : refreshing ? 'ATUALIZANDO' : 'DADOS PENDENTES'}
            </div>
          </div>
        </header>

        <section className="flex flex-col justify-between gap-5 py-6 lg:flex-row lg:items-end lg:py-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E97A61] sm:text-sm">Desafio entre unidades</p>
            <h1 className="mt-2 font-display text-4xl leading-none sm:text-5xl lg:text-6xl">{view === 'ranking' ? `Ranking ${period === 'mes' ? 'mensal' : 'diário'}` : `Placar do ${periodLabel}`}</h1>
            <p className="mt-3 text-sm text-white/60 sm:text-base">{period === 'mes' ? 'Acumulado até' : 'Turno de'} {date.split('-').reverse().join('/')}{snapshot.updatedAt ? ` · Atualizado às ${formatKdsTime(snapshot.updatedAt)}` : ''}</p>
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
            <button type="button" aria-label="Atualizar placar" disabled={refreshing} onClick={() => {
              setRefreshing(true)
              setRefreshKey((value) => value + 1)
            }} className="rounded-lg bg-white/10 p-2 text-[#EFE3C4] hover:bg-white/15">
              <RefreshCw size={17} />
            </button>
          </div>
        </section>

        {view === 'ranking' ? <CompetitionRankingPanel scores={scores} salesRanking={salesRanking} kitchenRanking={kitchenRanking} periodLabel={periodLabel} status={status} /> : (
          <section className="grid min-h-0 flex-1 grid-cols-2 gap-5">
            <RankingCard
              title={period === 'mes' ? 'Vendas no mês' : 'Vendas em tempo real'}
              subtitle={`Mesa e delivery no ${periodLabel}`}
              icon={<Trophy size={24} />}
              units={salesRanking}
              showPoints={false}
              prominent
            />
            <RankingCard
              title={period === 'mes' ? 'Tempo médio no mês' : 'Tempo médio em tempo real'}
              subtitle={`Cozinha de mesa e delivery no ${periodLabel}`}
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
          <span className="text-right" role="status">{refreshing ? 'Solicitando atualização à Saipos…' : status || (view === 'ranking' ? 'Ranking mensal e diário por pontuação' : 'Dia e Mês alternam a cada 1 min')}</span>
        </footer>
      </div>
    </main>
  )
}

function TvUnitDashboard({ unitId, unitName }: { unitId: string; unitName: string }) {
  const [data, setData] = useState<KdsPayload | null>(null)
  const [metrics, setMetrics] = useState<CompetitionBoard>({})
  const [period, setPeriod] = useState<CompetitionPeriod>('dia')
  const [kdsError, setKdsError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const { today, currentCompetitionDay: competitionDay } = useCompetitionDates()

  useEffect(() => {
    let alive = true
    let timer: number | undefined
    const load = async () => {
      let nextRefreshMs = KDS_REFRESH_MS
      try {
        const response = await fetch(`/api/kds?unidade=${unitId}`, {
          cache: 'no-store',
        })
        const payload = await readJson<KdsPayload & { error?: string }>(response)
        if (!response.ok) throw Object.assign(new Error(payload.error || 'Não foi possível atualizar o KDS.'), { status: response.status })
        if (!alive) return
        setData(payload)
        setKdsError(payload.warning || '')
        setUpdatedAt(new Date(payload.fetchedAt))
      } catch (reason) {
        if (!alive) return
        const status = reason instanceof Error && 'status' in reason ? Number(reason.status) : 0
        setKdsError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o KDS.')
        if (status === 503) nextRefreshMs = KDS_RETRY_MS
      } finally {
        if (alive) {
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

  useEffect(() => {
    const timer = window.setInterval(() => setPeriod((current) => current === 'dia' ? 'mes' : 'dia'), AUTO_SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined
    let lastKitchen = 0
    let lastMonth = 0
    let dailyKitchenStatus: CompetitionStatus = { pending: true, error: '', stale: false }
    const unitOrder = [unitId, ...COMPETITION_UNIT_IDS.filter((id) => id !== unitId)]
    const dateFor = (selected: CompetitionPeriod) => selected === 'dia' ? competitionDay : today

    function update(selected: CompetitionPeriod, apply: (snapshot: CompetitionSnapshot) => CompetitionSnapshot) {
      if (controller.signal.aborted) return
      setMetrics((current) => ({
        ...current,
        [selected]: apply(boardSnapshot(current, selected, dateFor(selected))),
      }))
    }

    const load = (selected: CompetitionPeriod, kitchen = false) => loadCompetitionUnits({
      unitIds: unitOrder,
      date: dateFor(selected),
      period: selected,
      kitchen,
      signal: controller.signal,
      onUnit: (unit, fields, fetchedAt, stale) => update(selected, (current) => mergeCompetitionUnit(current, unit, fields, fetchedAt, stale)),
    })

    const run = async () => {
      const sales = await load('dia')
      if (controller.signal.aborted) return
      if (Date.now() - lastKitchen >= 3 * REFRESH_MS || dailyKitchenStatus.stale || dailyKitchenStatus.error) {
        dailyKitchenStatus = await load('dia', true)
        lastKitchen = Date.now()
      }
      update('dia', (current) => ({
        ...current,
        status: {
          pending: sales.pending || dailyKitchenStatus.pending,
          stale: sales.stale || dailyKitchenStatus.stale,
          error: sales.error || dailyKitchenStatus.error,
        },
      }))
      if (controller.signal.aborted) return
      let monthPending = false
      if (Date.now() - lastMonth >= 10 * REFRESH_MS) {
        const month = await load('mes')
        update('mes', (current) => ({ ...current, status: month }))
        monthPending = month.pending || month.stale
        if (!monthPending && !month.error) lastMonth = Date.now()
      }
      if (!controller.signal.aborted) {
        timer = window.setTimeout(() => { void run() }, monthPending ? COMPETITION_RETRY_MS : REFRESH_MS)
      }
    }

    void run()
    return () => {
      controller.abort()
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [competitionDay, today, unitId])

  const urgentOrders = data?.queue.filter((order) => order.urgent) ?? []
  const activeOrders = data?.queue ?? []
  const snapshot = boardSnapshot(metrics, period, period === 'dia' ? competitionDay : today)
  const salesRanking = [...snapshot.units].sort((a, b) => (b.orders ?? -1) - (a.orders ?? -1) || a.name.localeCompare(b.name))
  const kitchenRanking = [...snapshot.units].sort((a, b) => (a.kitchenMinutes ?? Infinity) - (b.kitchenMinutes ?? Infinity) || a.name.localeCompare(b.name))
  const periodLabel = period === 'dia' ? `Turno ${competitionDay.split('-').reverse().slice(0, 2).join('/')}` : 'Este mês'
  const metricsStatus = statusMessage(snapshot, period)

  return (
    <main className="h-screen h-[100dvh] overflow-hidden bg-[#090E20] p-3 text-[#F9F6EC] sm:p-4 lg:p-5">
      <div className="pointer-events-none fixed -left-32 top-20 h-[32rem] w-[32rem] rounded-full bg-[#3151A7]/25 blur-[140px]" />
      <div className="pointer-events-none fixed -right-24 -top-28 h-[28rem] w-[28rem] rounded-full bg-[#E15B3F]/20 blur-[130px]" />
      <div className="relative mx-auto grid h-full max-w-[1800px] grid-rows-[auto_minmax(0,1fr)] gap-3 lg:gap-4">
        <header className="flex min-h-12 items-center justify-between gap-4 border-b border-white/12 px-1 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-display text-2xl tracking-tight text-[#EFE3C4] lg:text-3xl">Panela Velha</span>
            <span className="h-7 w-px bg-white/20" />
            <div className="min-w-0"><p className="truncate text-sm font-extrabold uppercase tracking-[0.16em]">Operação · {unitName}</p><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">Turno {data?.date ? data.date.split('-').reverse().slice(0, 2).join('/') : '—'} · Atualizado {formatKdsTime(updatedAt.toISOString())}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/tv/competicao?aba=ranking&periodo=mes&origem=${unitId}`} className="inline-flex items-center gap-1.5 rounded-full border border-[#F4B942]/35 bg-[#F4B942]/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-[#F4B942]"><Trophy size={14} /> Ranking</Link>
            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold">
              {data && !data.stale && !kdsError ? 'KDS AO VIVO' : 'KDS AGUARDANDO'}
            </div>
          </div>
        </header>

        <section className="grid h-full min-h-0 grid-cols-2 gap-3 overflow-hidden lg:gap-4" style={{ gridTemplateRows: 'repeat(2, minmax(0, 1fr))' }}>
          <TvPanel title="KDS agora" subtitle={`${data?.preparing ?? 0} em preparo`} icon={<Store size={20} />}>
            <CompactOrderList orders={activeOrders} empty="Nenhum pedido em preparo" />
          </TvPanel>

          <TvPanel title="Tempo médio" subtitle={`${periodLabel} · mesa e delivery`} icon={<Clock3 size={20} />} badge={period === 'dia' ? 'DIA' : 'MÊS'}>
            <CompactRanking units={kitchenRanking} type="kitchen" highlight={unitName} />
          </TvPanel>

          <TvPanel title="Vendas" subtitle={`${periodLabel} · mesa e delivery`} icon={<Trophy size={20} />} badge={period === 'dia' ? 'DIA' : 'MÊS'}>
            <CompactRanking units={salesRanking} type="sales" highlight={unitName} />
          </TvPanel>

          <TvPanel title="Pedidos urgentes" subtitle={`Há ${data?.urgentAfterMinutes ?? 15} min ou mais`} icon={<AlertTriangle size={20} />} urgent badge={String(urgentOrders.length)}>
            <CompactOrderList orders={urgentOrders} empty="Nenhum pedido urgente" urgent />
          </TvPanel>
        </section>
      </div>
      {(kdsError || metricsStatus) ? <div role="status" className="fixed bottom-2 left-1/2 z-20 max-w-[90vw] -translate-x-1/2 rounded-full border border-[#E15B3F]/35 bg-[#321A27]/95 px-4 py-1.5 text-center text-xs text-[#FFB3A6] shadow-xl">{[kdsError, metricsStatus].filter(Boolean).join(' · ')}</div> : null}
    </main>
  )
}

function TvPanel({ title, subtitle, icon, badge, urgent = false, children }: { title: string; subtitle: string; icon: ReactNode; badge?: string; urgent?: boolean; children: ReactNode }) {
  return <article className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border p-3 shadow-xl lg:rounded-[24px] lg:p-4 ${urgent ? 'border-[#E15B3F]/45 bg-[#2A1625]/90' : 'border-white/10 bg-[#0D1731]/90'}`}>
    <div className={`mb-2 flex items-center justify-between gap-3 border-b pb-2 ${urgent ? 'border-[#E15B3F]/30' : 'border-white/10'}`}>
      <div className="flex min-w-0 items-center gap-2.5"><span className={`rounded-lg p-2 ${urgent ? 'bg-[#E15B3F]/18 text-[#FF8E78]' : 'bg-white/8 text-[#EFE3C4]'}`}>{icon}</span><div className="min-w-0"><h2 className="truncate font-display text-[clamp(1.35rem,2.1vw,2rem)] leading-none">{title}</h2><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">{subtitle}</p></div></div>
      {badge ? <span className={`flex min-w-10 items-center justify-center rounded-full px-2.5 py-1 text-xs font-extrabold ${urgent ? 'bg-[#E15B3F] text-white' : 'bg-[#F4B942] text-[#18142A]'}`}>{badge}</span> : null}
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
  </article>
}

function CompactOrderList({ orders, empty, urgent = false }: { orders: KdsOrder[]; empty: string; urgent?: boolean }) {
  if (orders.length === 0) return <div className="flex h-full min-h-16 items-center justify-center text-sm font-semibold text-white/35">{empty}</div>
  return <ol className="grid grid-cols-2 content-start gap-1">
    {orders.slice(0, 8).map((order, index) => <li key={`${order.code}-${index}`} className={`flex min-h-0 items-center justify-between gap-1.5 rounded-lg border px-2 py-1 ${urgent ? 'border-[#E15B3F]/35 bg-[#E15B3F]/10' : 'border-white/8 bg-[#090E20]/55'}`}>
      <div className="min-w-0"><p className="truncate font-display text-lg leading-none">{order.label || (order.channel === 'delivery' ? '#' : 'Mesa')}</p><p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-white/40">{[kdsChannelLabel(order.channel), order.reference, kdsStatusLabel(order.status)].filter(Boolean).join(' · ')}</p></div>
      <strong className={`shrink-0 font-display text-lg tabular-nums ${urgent ? 'text-[#FF8E78]' : 'text-[#F4B942]'}`}>{typeof order.waitingMinutes === 'number' ? `${order.waitingMinutes}m` : '—'}</strong>
    </li>)}
  </ol>
}

function CompactRanking({ units, type, highlight }: { units: UnitScore[]; type: 'sales' | 'kitchen'; highlight: string }) {
  const field = type === 'sales' ? 'orders' : 'kitchen'
  const complete = units.every((unit) => unit.ready[field])
  const valueOf = (unit: UnitScore) => type === 'sales' ? unit.orders : unit.kitchenMinutes
  return <ol className="grid h-full min-h-0 gap-1.5" style={{ gridTemplateRows: `repeat(${units.length}, minmax(0, 1fr))` }}>
    {units.map((unit, index) => {
      const value = valueOf(unit)
      const position = complete && value !== null ? rankingPosition(units, index, valueOf) : null
      return <li key={unit.name} className={`grid min-h-0 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-3 ${unit.name === highlight ? 'border-[#F4B942]/45 bg-[#F4B942]/10' : 'border-white/8 bg-white/[0.035]'}`}>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold ${position === 1 ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/10 text-white/60'}`}>{position ?? '—'}</span>
        <p className="min-w-0 truncate text-sm font-extrabold lg:text-base">{unit.name}{unit.name === highlight ? <span className="ml-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[#F4B942]">Esta unidade</span> : null}</p>
        <strong className="font-display text-[clamp(1.15rem,1.7vw,1.7rem)] leading-none tabular-nums">{value === null ? '—' : `${value.toLocaleString('pt-BR')}${type === 'kitchen' ? ' min' : ''}`}</strong>
      </li>
    })}
  </ol>
}

function kdsChannelLabel(channel: KdsOrder['channel']) {
  if (channel === 'delivery') return 'Delivery'
  if (channel === 'mesa') return 'Mesa'
  return 'Balcão/outros'
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

function CompetitionRankingPanel({ scores, salesRanking, kitchenRanking, periodLabel, status }: { scores: CompetitionScore[]; salesRanking: UnitScore[]; kitchenRanking: UnitScore[]; periodLabel: string; status: string }) {
  return (
    <section className="mt-1 min-h-0 flex-1">
      <article className="rounded-[28px] border border-[#F4B942]/35 bg-gradient-to-br from-[#303060] via-[#182658] to-[#101a3a] p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-5">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F4B942]">Classificação geral</p><h2 className="mt-1 font-display text-3xl">Ranking do {periodLabel}</h2></div>
          <Trophy className="text-[#F4B942]" size={42} />
        </div>
        <ol className="mt-3 divide-y divide-white/12">
          {scores.length === 0 ? <li className="py-8 text-center text-sm text-white/55">{status || 'Aguardando dados das três unidades…'}</li> : scores.map((unit, index) => {
            const position = rankingPosition(scores, index, (item) => item.total)
            return <li key={unit.name} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 py-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full font-extrabold ${position === 1 ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/10 text-white/70'}`}>{position}</span>
              <div><p className="font-display text-2xl">{unit.name}</p><p className="mt-1 text-xs text-white/55">{unit.salesPoints} pts em vendas · {unit.kitchenPoints} pts em rapidez</p></div>
              <strong className="font-display text-3xl text-[#F4B942]">{unit.total} pts</strong>
            </li>
          })}
        </ol>
      </article>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <RankingCard title={`Vendas do ${periodLabel}`} subtitle="Mesa e delivery" icon={<Trophy size={20} />} units={salesRanking} showPoints={periodLabel === 'dia'} />
        <RankingCard title={`Rapidez no ${periodLabel}`} subtitle="Cozinha de mesa e delivery" icon={<Clock3 size={20} />} units={kitchenRanking} type="kitchen" showPoints={periodLabel === 'dia'} />
      </div>
    </section>
  )
}

function RankingCard({ title, subtitle, icon, units, type = 'sales', showPoints = true, prominent = false }: { title: string; subtitle: string; icon: ReactNode; units: UnitScore[]; type?: 'sales' | 'kitchen'; showPoints?: boolean; prominent?: boolean }) {
  const field = type === 'sales' ? 'orders' : 'kitchen'
  const complete = units.every((unit) => unit.ready[field])
  const maxOrders = Math.max(1, ...units.map((unit) => unit.orders ?? 0))
  const fastestKitchen = units.find((unit) => typeof unit.kitchenMinutes === 'number')?.kitchenMinutes ?? 0
  return (
    <article className={`rounded-[28px] border border-white/10 bg-[#0D1731]/80 shadow-xl backdrop-blur ${prominent ? 'p-5 sm:p-7' : 'p-4 sm:p-5'}`}>
      <div className={`flex items-center justify-between gap-3 border-b border-white/10 ${prominent ? 'pb-5' : 'pb-4'}`}>
        <div><h2 className={`font-display ${prominent ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>{title}</h2><p className={`mt-1 text-white/50 ${prominent ? 'text-sm' : 'text-xs'}`}>{subtitle}</p></div>
        <span className={`rounded-xl bg-white/8 text-[#EFE3C4] ${prominent ? 'p-3.5' : 'p-2.5'}`}>{icon}</span>
      </div>
      <ol className="mt-2 divide-y divide-white/8">
        {units.map((unit, index) => {
          const value = type === 'sales' ? (typeof unit.orders === 'number' ? `${unit.orders} vendas` : '—') : typeof unit.kitchenMinutes !== 'number' ? '—' : `${unit.kitchenMinutes.toLocaleString('pt-BR')} min`
          const width = type === 'sales' ? ((unit.orders ?? 0) / maxOrders) * 100 : unit.kitchenMinutes ? (fastestKitchen / unit.kitchenMinutes) * 100 : 0
          const position = type === 'sales'
            ? rankingPosition(units, index, (item) => item.orders ?? -1)
            : rankingPosition(units, index, (item) => -(item.kitchenMinutes ?? Infinity))
          const hasPosition = complete && (type === 'sales' ? unit.orders !== null : unit.kitchenMinutes !== null)
          const points = hasPosition && (type === 'kitchen' || (unit.orders ?? 0) > 0) ? pointsForPosition(position) : 0
          return <li key={unit.name} className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-3 ${prominent ? 'py-5' : 'py-3'}`}>
            <span className={`flex items-center justify-center rounded-full font-extrabold ${prominent ? 'h-10 w-10 text-lg' : 'h-7 w-7 text-sm'} ${hasPosition && position === 1 ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/8 text-white/65'}`}>{hasPosition ? position : '—'}</span>
            <div className="min-w-0"><div className="flex justify-between gap-2"><p className={`truncate font-bold ${prominent ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'}`}>{unit.name}</p><span className="text-xs text-white/45">{type === 'sales' ? (typeof unit.orders === 'number' ? `${unit.orders} vendas` : '—') : 'preparo'}</span></div><div className={`mt-2 overflow-hidden rounded-full bg-white/10 ${prominent ? 'h-2' : 'h-1.5'}`}><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: unit.accent }} /></div></div>
            <div className="text-right"><strong className={`block font-display text-[#F9F6EC] ${prominent ? 'text-2xl sm:text-3xl' : 'text-base sm:text-lg'}`}>{value}</strong>{showPoints && hasPosition ? <span className="text-xs font-extrabold text-[#F4B942]">+{points} pts</span> : null}</div>
          </li>
        })}
      </ol>
    </article>
  )
}

function rankingPosition<T>(items: T[], index: number, valueOf: (item: T) => number | null) {
  const current = valueOf(items[index])
  return items.findIndex((item) => valueOf(item) === current) + 1
}
