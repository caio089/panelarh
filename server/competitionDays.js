import { readCompetitionSnapshot, saveCompetitionSnapshot } from './competitionCache.js'
import { getSaiposCompetitionMetrics, getSaiposCompetitionSales, shiftIsoDate } from './saiposDirceu.js'

const DAY_TIMEOUT_MS = 90_000
const FILL_BUDGET_MS = 60_000
const FILL_METRIC_BATCH_SIZE = 6
const RETRY_DELAY_MS = 60_000
const FAILURE_LIMIT = 256
const pendingDays = new Map()
const pendingMonths = new Map()
const retryTimes = new Map()
const leaseRetryTimes = new Map()

async function claimMonthlyFill(unitId) {
  const workerKey = process.env.COMPETITION_WORKER_KEY
  if (!workerKey && process.env.VERCEL !== '1') return true // Local development uses pendingMonths.
  if (Date.now() < (leaseRetryTimes.get(unitId) ?? 0)) return false
  // Limit failed/contended attempts on this instance. The database owns mutual exclusion.
  leaseRetryTimes.set(unitId, Date.now() + 15_000)
  try {
    const url = process.env.VITE_SUPABASE_URL
    const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    if (!url || !apiKey || !workerKey) throw new Error('Configuração do worker ausente')
    const response = await fetch(new URL('/rest/v1/rpc/claim_competition_fill', url), {
      method: 'POST',
      headers: { apikey: apiKey, 'Content-Type': 'application/json', 'x-competition-worker': workerKey },
      body: JSON.stringify({ p_unit_id: unitId }),
      signal: AbortSignal.timeout(3_000),
    })
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`)
    return (await response.json()) === true
  } catch (error) {
    console.warn('Preenchimento mensal adiado:', unitId, error instanceof Error ? error.message : 'Falha ao obter reserva')
    return false
  }
}

function dayKey(unitId, day, metric) {
  return `${unitId}:${day}:${metric}`
}

function averageMinutes(seconds, samples) {
  return samples ? Math.round((seconds / samples / 60) * 10) / 10 : null
}

function isStale(snapshot, day, today, yesterday, metric, now) {
  if (!snapshot) return false
  const age = now - snapshot.fetchedAt
  if (day === today) return age >= (metric === 'sales' ? 60_000 : 180_000)
  if (day === yesterday) return age >= 5 * 60_000
  if (day < shiftIsoDate(today, -7)) return age >= 30 * 24 * 60 * 60_000
  return age >= 24 * 60 * 60_000
}

function canRetry(unitId, day, metric) {
  return Date.now() >= (retryTimes.get(dayKey(unitId, day, metric)) ?? 0)
}

function refreshDayMetric({ unitId, day, token, metric, signal }) {
  const key = dayKey(unitId, day, metric)
  const current = pendingDays.get(key)
  if (current) return current

  const fetchedAt = Date.now()
  const sourceSignal = signal ?? AbortSignal.timeout(DAY_TIMEOUT_MS)
  const task = (async () => {
    const options = { token, signal: sourceSignal, fresh: true, cacheScope: unitId }
    let value
    if (metric === 'sales') {
      value = await getSaiposCompetitionSales({ ...options, date: day })
    } else {
      const metrics = await getSaiposCompetitionMetrics({ ...options, start: day, end: day })
      value = metrics.dailyKitchenTotals[day]
    }
    const snapshot = await saveCompetitionSnapshot(unitId, day, metric, { fetchedAt, value })
    retryTimes.delete(key)
    return snapshot
  })().catch((error) => {
    retryTimes.delete(key)
    retryTimes.set(key, Date.now() + RETRY_DELAY_MS)
    if (retryTimes.size > FAILURE_LIMIT) retryTimes.delete(retryTimes.keys().next().value)
    throw error
  }).finally(() => pendingDays.delete(key))

  pendingDays.set(key, task)
  return task
}

export async function loadCompetitionDay({ unitId, day, today, token, kitchenOnly, fresh = false }) {
  const metric = kitchenOnly ? 'kitchen' : 'sales'
  const snapshot = await readCompetitionSnapshot(unitId, day, metric)
  const refresh = () => refreshDayMetric({ unitId, day, token, metric })
  const stale = isStale(snapshot, day, today, shiftIsoDate(today, -1), metric, Date.now())
  if (snapshot && !fresh) {
    return { snapshot, stale, refresh: stale && canRetry(unitId, day, metric) ? refresh : null }
  }
  if (!fresh && !canRetry(unitId, day, metric)) {
    throw new Error('A Saipos está temporariamente indisponível. Tente novamente em um minuto.')
  }
  try {
    return { snapshot: await refresh(), stale: false, refresh: null }
  } catch (error) {
    if (!snapshot) throw error
    return { snapshot, stale: true, refresh: null, error: error instanceof Error ? error.message : 'A Saipos não respondeu.' }
  }
}

export function competitionDayPayload(snapshot, kitchenOnly) {
  return kitchenOnly
    ? { orders: null, kitchenMinutes: averageMinutes(snapshot.value.seconds, snapshot.value.samples) }
    : { orders: snapshot.value, kitchenMinutes: null }
}

export async function loadCompetitionSpan({ unitId, token, start, end, today, kitchenOnly, fresh = false }) {
  const days = []
  for (let day = start; day <= end; day = shiftIsoDate(day, 1)) days.push(day)
  const yesterday = shiftIsoDate(today, -1)
  const data = await Promise.all(days.map(async (day) => {
    const localTtl = fresh ? 0 : day < yesterday ? 5 * 60_000 : 30_000
    const [sales, kitchen] = await Promise.all([
      readCompetitionSnapshot(unitId, day, 'sales', localTtl),
      readCompetitionSnapshot(unitId, day, 'kitchen', localTtl),
    ])
    return { day, sales, kitchen }
  }))

  const now = Date.now()
  const coverage = { totalDays: days.length, salesDays: 0, kitchenDays: 0 }
  let orders = 0
  let seconds = 0
  let samples = 0
  let fetchedAt = 0
  let stale = false
  const work = { sales: [], kitchen: [] }
  for (const { day, sales, kitchen } of data) {
    if (sales) {
      coverage.salesDays += 1
      orders += sales.value
      if (!kitchenOnly) fetchedAt = Math.max(fetchedAt, sales.fetchedAt)
    }
    if (kitchen) {
      coverage.kitchenDays += 1
      seconds += kitchen.value.seconds
      samples += kitchen.value.samples
      fetchedAt = Math.max(fetchedAt, kitchen.fetchedAt)
    }
    const forceDay = fresh && day >= yesterday
    const salesStale = isStale(sales, day, today, yesterday, 'sales', now)
    const kitchenStale = isStale(kitchen, day, today, yesterday, 'kitchen', now)
    if (!kitchenOnly && (salesStale || (forceDay && sales))) stale = true
    if (kitchenStale || (forceDay && kitchen)) stale = true

    const loadSales = !kitchenOnly && (forceDay || ((!sales || salesStale) && canRetry(unitId, day, 'sales')))
    const loadKitchen = forceDay || ((!kitchen || kitchenStale) && canRetry(unitId, day, 'kitchen'))
    if (loadSales) work.sales.push({ day, forceDay, priority: forceDay ? 0 : sales ? 2 : 1, fetchedAt: sales?.fetchedAt ?? 0 })
    if (loadKitchen) work.kitchen.push({ day, forceDay, priority: forceDay ? 0 : kitchen ? 2 : 1, fetchedAt: kitchen?.fetchedAt ?? 0 })
  }

  const salesReady = coverage.salesDays === coverage.totalDays
  const kitchenReady = coverage.kitchenDays === coverage.totalDays
  const partial = !kitchenReady || (!kitchenOnly && !salesReady)
  for (const jobs of Object.values(work)) {
    jobs.sort((a, b) => a.priority - b.priority || a.fetchedAt - b.fetchedAt || b.day.localeCompare(a.day))
  }
  return {
    coverage,
    partial,
    stale,
    fetchedAt,
    orders: salesReady && !kitchenOnly ? orders : null,
    kitchenMinutes: kitchenReady ? averageMinutes(seconds, samples) : null,
    observedOrders: coverage.salesDays && !kitchenOnly ? orders : null,
    observedKitchenMinutes: coverage.kitchenDays ? averageMinutes(seconds, samples) : null,
    days: salesReady && kitchenReady ? data.map(({ day, sales, kitchen }) => ({
      date: day,
      orders: sales.value,
      kitchenMinutes: averageMinutes(kitchen.value.seconds, kitchen.value.samples),
    })) : null,
    fill: work.sales.length || work.kitchen.length ? () => fillDays({ unitId, token, work, fresh, now }) : null,
  }
}

function fillDays({ unitId, token, work, fresh, now }) {
  const current = pendingMonths.get(unitId)
  if (current) {
    // Uma atualização manual ainda entra na fila se um lote automático já estiver em andamento.
    return fresh && !current.fresh
      ? current.task.then(() => fillDays({ unitId, token, work, fresh, now }))
      : current.task
  }
  const signal = AbortSignal.timeout(FILL_BUDGET_MS)
  const task = (async () => {
    if (!await claimMonthlyFill(unitId) || signal.aborted) return
    for (const metric of ['sales', 'kitchen']) {
      for (const { day, forceDay, fetchedAt } of work[metric].slice(0, FILL_METRIC_BATCH_SIZE)) {
        if (signal.aborted) return
        try {
          const recent = await readCompetitionSnapshot(unitId, day, metric, 0)
          const lastSeen = forceDay ? now : fetchedAt
          if (!recent || recent.fetchedAt <= lastSeen) {
            await refreshDayMetric({ unitId, token, day, metric, signal })
          }
        } catch {
          // Uma métrica indisponível não impede os demais dias e métricas.
        }
      }
    }
  })().finally(() => pendingMonths.delete(unitId))

  pendingMonths.set(unitId, { fresh, task })
  return task
}
