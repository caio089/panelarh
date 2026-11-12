import { competitionOrderCount, getSaiposCompetitionMetrics, getSaiposReport, todayInFortaleza } from '../server/saiposDirceu.js'
import { saiposUnit } from '../server/saiposUnits.js'
import { waitUntil } from '@vercel/functions'
import { readCompetitionCache, saveCompetitionCache } from '../server/competitionCache.js'

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function monthDays(start, end) {
  const days = []
  const cursor = new Date(`${start}T12:00:00Z`)
  const final = new Date(`${end}T12:00:00Z`)
  while (cursor <= final) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function dailyResultClosed(date, today, now = new Date()) {
  if (date < today) return true
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  return hour > 23 || (hour === 23 && minute >= 40)
}

function cacheAge(payload) {
  const fetchedAt = Date.parse(payload?.fetchedAt || '')
  return Number.isFinite(fetchedAt) ? Date.now() - fetchedAt : Number.POSITIVE_INFINITY
}

/**
 * Uma unidade por chamada. A TV pede a casa que está na tela primeiro e só
 * depois as outras, para a Saipos não receber as três lojas ao mesmo tempo.
 */
async function loadUnit({ unit, date, period, kitchenOnly, dailyRanking, signal, fresh }) {
  const start = period === 'mes' ? `${date.slice(0, 7)}-01` : date
  if (dailyRanking) {
    const metrics = await getSaiposCompetitionMetrics({
      start, end: date, token: unit.token(), signal, fresh, cacheScope: unit.id,
    })
    const days = monthDays(start, date).map((day) => ({
      date: day,
      orders: metrics.counts.get(day) || 0,
      kitchenMinutes: typeof metrics.dailyKitchenMinutes[day] === 'number' ? metrics.dailyKitchenMinutes[day] : null,
    }))
    return {
      date,
      period: 'mes',
      fetchedAt: new Date().toISOString(),
      unit: {
        id: unit.id,
        name: unit.name,
        orders: days.reduce((total, day) => total + day.orders, 0),
        kitchenMinutes: metrics.averageMinutes ?? null,
      },
      days,
    }
  }

  if (kitchenOnly) {
    const kitchen = await getSaiposCompetitionMetrics({
      start, end: date, token: unit.token(), signal, fresh, cacheScope: unit.id,
    })
    return {
      date,
      period,
      fetchedAt: new Date().toISOString(),
      unit: {
        id: unit.id,
        name: unit.name,
        orders: null,
        kitchenMinutes: kitchen.averageMinutes ?? null,
      },
    }
  }

  const sales = await getSaiposReport({
    date,
    category: 'faturamento',
    period,
    token: unit.token(),
    signal,
    fresh,
    unit: unit.name,
    cacheScope: unit.id,
  })
  return {
    date,
    period,
    fetchedAt: new Date().toISOString(),
    unit: {
      id: unit.id,
      name: unit.name,
      orders: competitionOrderCount(sales.report),
      kitchenMinutes: null,
    },
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })
  const today = todayInFortaleza()
  const requestedDate = typeof req.query?.dia === 'string' ? req.query.dia : ''
  const requestedPeriod = typeof req.query?.periodo === 'string' ? req.query.periodo : 'dia'
  const requestedUnit = typeof req.query?.unidade === 'string' ? req.query.unidade.trim().toLowerCase() : ''
  const dailyRanking = req.query?.modo === 'diario'
  const kitchenOnly = req.query?.dados === 'cozinha'
  const forceRefresh = req.query?.atualiza === '1'
  const unit = saiposUnit(requestedUnit)
  if (!unit) return res.status(400).json({ error: 'Informe a unidade.' })

  const metric = dailyRanking ? 'ranking-pontos-diarios-v3' : kitchenOnly ? 'cozinha-mesa-delivery' : 'vendas-mesa-delivery'
  if (requestedDate && (!isIsoDate(requestedDate) || requestedDate > today)) {
    return res.status(400).json({ error: 'Informe uma data válida até hoje.' })
  }
  if (!dailyRanking && requestedPeriod !== 'dia' && requestedPeriod !== 'mes') {
    return res.status(400).json({ error: 'Informe período dia ou mes.' })
  }

  const period = dailyRanking ? 'mes' : requestedPeriod
  const date = period === 'mes' ? today : requestedDate || today
  const scoreboardClosed = period === 'dia' && !dailyRanking && !kitchenOnly && dailyResultClosed(date, today)
  const refreshAfter = period === 'dia' && !dailyRanking ? 60 * 1000 : 10 * 60 * 1000

  const refresh = () => loadUnit({
    unit, date, period, kitchenOnly, dailyRanking, signal: new AbortController().signal, fresh: true,
  }).then((payload) => saveCompetitionCache(period, date, metric, unit.id, payload))

  const cached = await readCompetitionCache(period, date, metric, unit.id)
  if (cached?.unit && !forceRefresh) {
    if (!scoreboardClosed && cacheAge(cached) >= refreshAfter) waitUntil(refresh().catch(() => undefined))
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=90')
    return res.status(200).json({ ...cached, cached: true, closed: scoreboardClosed })
  }

  if (forceRefresh && scoreboardClosed && cached?.unit) {
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=90')
    return res.status(200).json({ ...cached, cached: true, closed: true })
  }

  const controller = new AbortController()
  req.on?.('close', () => controller.abort())
  try {
    const payload = await loadUnit({
      unit, date, period, kitchenOnly, dailyRanking, signal: controller.signal, fresh: forceRefresh,
    })
    await saveCompetitionCache(period, date, metric, unit.id, payload)
    res.setHeader('Cache-Control', forceRefresh ? 'no-store' : 's-maxage=30, stale-while-revalidate=90')
    return res.status(200).json(payload)
  } catch (error) {
    if (controller.signal.aborted) return
    const message = error instanceof Error ? error.message : 'Não foi possível atualizar a competição.'
    return res.status(503).json({ error: message })
  }
}
