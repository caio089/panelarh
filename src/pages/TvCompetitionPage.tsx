import { AlertTriangle, CalendarDays, CalendarRange, Clock3, RefreshCw, Store, Trophy } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { COMPETITION_UNIT_IDS, fetchCompetitionUnit, type CompetitionDayPoint, type CompetitionFields, type CompetitionPeriod, type CompetitionUnitMetric } from '@/features/dirceu/competitionClient'
import { usePageVisible } from '@/features/dirceu/usePageVisible'
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
const MONTH_REFRESH_MS = 10 * REFRESH_MS

function useCompetitionDates() {
  const [now, setNow] = useState(() => new Date())
  const visible = usePageVisible()
  useEffect(() => {
    if (!visible) return
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [visible])
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

function mergeCompetitionUnit(snapshot: CompetitionSnapshot, unit: CompetitionUnitMetric, fields: CompetitionFields, fetchedAt?: string) {
  let changed = false
  const units = snapshot.units.map((existing) => {
    if (existing.name !== TV_UNITS[unit.id]) return existing
    const orders = fields.orders
    const kitchen = fields.kitchen
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

type Reading = {
  next: number
  failures: number
  refreshId?: number
  fetchedAt: number
  status: CompetitionStatus
  days?: CompetitionDayPoint[]
}
const PENDING_STATUS: CompetitionStatus = { pending: true, stale: false, error: '' }

/** Uma fila por tela. A troca visual entre dia e mês não altera a agenda de cada métrica/unidade. */
function useCompetitionBoard({
  today, day, currentDay, origin, showDay, showMonth, refresh,
}: {
  today: string
  day: string
  currentDay: string
  origin?: string | null
  showDay: boolean
  showMonth: boolean
  refresh?: { period: CompetitionPeriod; id: number }
}) {
  const visible = usePageVisible()
  const [board, setBoard] = useState<CompetitionBoard>({})
  const [ranking, setRanking] = useState<{ date: string; scores: CompetitionScore[] }>()
  const [finishedRefresh, setFinishedRefresh] = useState(0)
  const readings = useRef(new Map<string, Reading>())
  const appliedRefresh = useRef(0)

  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()
    const signal = controller.signal
    const units = origin && Object.hasOwn(TV_UNITS, origin)
      ? [origin, ...COMPETITION_UNIT_IDS.filter((id) => id !== origin)] : COMPETITION_UNIT_IDS
    const metrics = [
      ...(showDay ? ['sales', 'kitchen'] as const : []),
      ...(showMonth ? ['month'] as const : []),
    ]
    const jobs = metrics.flatMap((metric) => {
      const period: CompetitionPeriod = metric === 'month' ? 'mes' : 'dia'
      const date = period === 'mes' ? today : day
      const cadence = metric === 'month' ? MONTH_REFRESH_MS
        : day < currentDay ? HISTORICAL_REFRESH_MS : metric === 'kitchen' ? 3 * REFRESH_MS : REFRESH_MS
      return units.map((unitId) => ({ metric, period, date, cadence, unitId, key: [metric, date, unitId].join(':') }))
    })
    // Mantém a agenda ao mudar de aba ou voltar do segundo plano, sem reter datas antigas.
    for (const key of readings.current.keys()) {
      const [metric, date] = key.split(':')
      if (date !== (metric === 'month' ? today : day)) readings.current.delete(key)
    }

    function update(period: CompetitionPeriod, date: string, apply: (value: CompetitionSnapshot) => CompetitionSnapshot) {
      if (!signal.aborted) setBoard((previous) => ({ ...previous, [period]: apply(boardSnapshot(previous, period, date)) }))
    }

    function publishStatus(period: CompetitionPeriod, date: string) {
      const selected = jobs.filter((job) => job.period === period)
      const list = selected.map((job) => readings.current.get(job.key))
      const statuses = list.map((item) => item?.status ?? PENDING_STATUS)
      const status = {
        pending: statuses.some((value) => value.pending),
        stale: statuses.some((value) => value.stale),
        error: statuses.find((value) => value.error)?.error ?? '',
      }
      update(period, date, (value) => ({ ...value, status }))
      if (period === 'mes' && list.every((item) => item?.days)) {
        const series = selected.map((job, index) => ({ name: TV_UNITS[job.unitId], days: list[index]!.days! }))
        setRanking({ date, scores: standingsFromDays(series) })
      }
    }

    let timer: number
    async function run() {
      const manual = refresh && appliedRefresh.current !== refresh.id
      for (const job of jobs) {
        if (signal.aborted) return
        const previous = readings.current.get(job.key)
        const fresh = Boolean(manual && refresh?.period === job.period && previous?.refreshId !== refresh.id)
        if (!fresh && previous && previous.next > Date.now()) continue
        let status: CompetitionStatus
        let days = previous?.days
        let fetchedAt = previous?.fetchedAt ?? 0
        try {
          const payload = await fetchCompetitionUnit({
            unitId: job.unitId, date: job.date, period: job.period,
            kitchen: job.metric === 'kitchen', daily: job.metric === 'month', fresh, signal,
          })
          if (signal.aborted) return
          const { unit, fields } = payload
          const complete = job.metric === 'sales' ? fields.orders : job.metric === 'kitchen' ? fields.kitchen : fields.orders && fields.kitchen
          let error = payload.error || ''
          const sourceTime = Date.parse(payload.fetchedAt ?? '') || 0
          const current = sourceTime >= fetchedAt
          if (job.metric === 'month' && complete && current) {
            const valid = payload.days?.length === Number(today.slice(-2)) && payload.days.every(
              (point, index) => point.date === today.slice(0, 8) + String(index + 1).padStart(2, '0'),
            )
            if (valid) days = payload.days
            else error ||= 'A série de dias do ranking veio incompleta.'
          }
          status = { pending: Boolean(payload.partial) || !complete, stale: Boolean(payload.stale), error }
          if (current && (fields.orders || fields.kitchen)) {
            fetchedAt = sourceTime
            update(job.period, job.date, (value) => mergeCompetitionUnit(value, unit, fields, payload.fetchedAt))
          }
        } catch (reason) {
          if (signal.aborted) return
          status = { pending: false, stale: false, error: reason instanceof Error ? reason.message : 'Consulta indisponível.' }
        }
        const failures = status.pending || status.error ? (previous?.failures ?? 0) + 1 : 0
        const normalDelay = fresh && status.stale ? REFRESH_MS : job.cadence
        const delay = failures ? Math.min(MONTH_REFRESH_MS, REFRESH_MS * 2 ** Math.min(4, failures - 1)) : normalDelay
        readings.current.set(job.key, {
          next: Date.now() + delay, failures, fetchedAt, status, days,
          refreshId: fresh ? refresh?.id : previous?.refreshId,
        })
        publishStatus(job.period, job.date)
      }
      if (signal.aborted) return
      if (manual && refresh) {
        appliedRefresh.current = refresh.id
        setFinishedRefresh(refresh.id)
      }
      const next = Math.min(...jobs.map((job) => readings.current.get(job.key)!.next))
      timer = window.setTimeout(run, Math.max(0, next - Date.now()))
    }
    timer = window.setTimeout(run, 0)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [currentDay, day, origin, refresh, showDay, showMonth, today, visible])

  return { board, ranking, refreshing: Boolean(refresh && refresh.id !== finishedRefresh) }
}

export function TvCompetitionPage() {
  const { unit: requestedUnit } = useParams()
  const { pathname } = useLocation()
  const routeUnit = requestedUnit || pathname.split('/').filter(Boolean).at(-1) || ''
  const tvUnitId = unitSlug(routeUnit)

  if (tvUnitId) return <TvUnitDashboard key={tvUnitId} unitId={tvUnitId} unitName={TV_UNITS[tvUnitId]} />
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
  const visible = usePageVisible()
  const [refresh, setRefresh] = useState<{ period: CompetitionPeriod; id: number }>()
  const { board, ranking: monthlyRanking, refreshing } = useCompetitionBoard({
    today, day: selectedDate, currentDay: currentCompetitionDay, origin: originUnit,
    showDay: view === 'placar' || period === 'dia', showMonth: view === 'placar' || period === 'mes', refresh,
  })
  const snapshot = boardSnapshot(board, period, date)
  const units = snapshot.units
  const hasMonthlyData = boardSnapshot(board, 'mes', today).units.some((unit) => unit.ready.orders || unit.ready.kitchen)
  useEffect(() => {
    if (!visible || view !== 'placar' || refreshing) return
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
  }, [setParams, hasMonthlyData, refreshing, view, visible])

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
              setRefresh((current) => ({ period, id: (current?.id ?? 0) + 1 }))
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
  const visible = usePageVisible()
  const [period, setPeriod] = useState<CompetitionPeriod>('dia')
  const [kdsError, setKdsError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  const { today, currentCompetitionDay: competitionDay } = useCompetitionDates()

  const { board: metrics } = useCompetitionBoard({
    today, day: competitionDay, currentDay: competitionDay, origin: unitId, showDay: true, showMonth: true,
  })

  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()
    let timer: number
    const load = async () => {
      let nextRefreshMs = KDS_REFRESH_MS
      try {
        const response = await fetch(`/api/kds?unidade=${unitId}`, {
          signal: controller.signal,
        })
        const payload = await readJson<KdsPayload & { error?: string }>(response)
        if (!response.ok) throw Object.assign(new Error(payload.error || 'Não foi possível atualizar o KDS.'), { status: response.status })
        if (controller.signal.aborted) return
        setData(payload)
        setKdsError(payload.warning || '')
        if (payload.warning) nextRefreshMs = KDS_RETRY_MS
        setUpdatedAt(new Date(payload.fetchedAt))
      } catch (reason) {
        if (controller.signal.aborted) return
        const status = reason instanceof Error && 'status' in reason ? Number(reason.status) : 0
        setKdsError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o KDS.')
        nextRefreshMs = status >= 400 && status < 500 ? MONTH_REFRESH_MS : KDS_RETRY_MS
      } finally {
        if (!controller.signal.aborted) {
          timer = window.setTimeout(() => { void load() }, nextRefreshMs)
        }
      }
    }
    timer = window.setTimeout(load, 0)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [unitId, visible])

  useEffect(() => {
    if (!visible) return
    const timer = window.setInterval(() => setPeriod((current) => current === 'dia' ? 'mes' : 'dia'), AUTO_SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [visible])

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
