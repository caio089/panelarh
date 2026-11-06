import { getSaiposDailySalesCounts, getSaiposReport, todayInFortaleza } from '../server/saiposDirceu.js'
import { SAIPOS_UNITS } from '../server/saiposUnits.js'
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

function kitchenMinutes(report) {
  const stages = Array.isArray(report?.stages) ? report.stages : []
  const cooking = stages.find((stage) => String(stage.label).trim().toLowerCase() === 'cozinha')
  return typeof cooking?.averageMinutes === 'number' ? cooking.averageMinutes : null
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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })
  const today = todayInFortaleza()
  const requestedDate = typeof req.query?.dia === 'string' ? req.query.dia : ''
  const requestedPeriod = typeof req.query?.periodo === 'string' ? req.query.periodo : 'dia'
  const dailyRanking = req.query?.modo === 'diario'
  const kitchenOnly = req.query?.dados === 'cozinha'
  const forceRefresh = req.query?.atualiza === '1'
  const metric = dailyRanking ? 'ranking-diario' : kitchenOnly ? 'cozinha' : 'vendas'
  if (requestedDate && (!isIsoDate(requestedDate) || requestedDate > today)) {
    return res.status(400).json({ error: 'Informe uma data válida até hoje.' })
  }
  if (!dailyRanking && requestedPeriod !== 'dia' && requestedPeriod !== 'mes') {
    return res.status(400).json({ error: 'Informe período dia ou mes.' })
  }
  const period = dailyRanking ? 'mes' : requestedPeriod
  // A competição mensal é sempre o acumulado do mês corrente. Isso evita que
  // um link ou cache de um mês anterior apareça como se fosse o mês atual.
  const date = period === 'mes' ? today : requestedDate || today
  const scoreboardClosed = period === 'dia' && dailyResultClosed(date, today)
  const loadScoreboard = async (signal, fresh = false) => {
    const units = await Promise.all(
      Object.values(SAIPOS_UNITS).map(async (unit) => {
        if (kitchenOnly) {
          try {
            const kitchen = await getSaiposReport({ date, category: 'cozinha', period, token: unit.token(), signal, fresh, unit: unit.name, cacheScope: unit.id })
            return { id: unit.id, name: unit.name, orders: 0, kitchenMinutes: kitchenMinutes(kitchen.report) }
          } catch {
            return { id: unit.id, name: unit.name, orders: 0, kitchenMinutes: null }
          }
        }
        const sales = await getSaiposReport({ date, category: 'faturamento', period, token: unit.token(), signal, fresh, unit: unit.name, cacheScope: unit.id })
        return {
          id: unit.id,
          name: unit.name,
          orders: sales.report.count,
        }
      }),
    )
    return { date, period, metric, fetchedAt: new Date().toISOString(), units }
  }

  const loadDailyRanking = async (signal, fresh = false) => {
    const start = `${today.slice(0, 7)}-01`
    const dailyCounts = await Promise.all(
      Object.values(SAIPOS_UNITS).map(async (unit) => ({
        unit,
        counts: await getSaiposDailySalesCounts({ start, end: today, token: unit.token(), signal, fresh, cacheScope: unit.id }),
      })),
    )
    const wins = new Map(Object.values(SAIPOS_UNITS).map((unit) => [unit.id, 0]))
    const days = monthDays(start, today).map((day) => {
      const units = dailyCounts.map(({ unit, counts }) => ({ id: unit.id, name: unit.name, orders: counts.get(day) || 0 }))
      const top = Math.max(...units.map((unit) => unit.orders))
      const winners = top > 0 ? units.filter((unit) => unit.orders === top) : []
      for (const winner of winners) wins.set(winner.id, (wins.get(winner.id) || 0) + 1)
      return { date: day, units, winners: winners.map((unit) => unit.id) }
    })
    return {
      date: today,
      period: 'mes',
      metric,
      fetchedAt: new Date().toISOString(),
      days,
      standings: Object.values(SAIPOS_UNITS).map((unit) => ({ id: unit.id, name: unit.name, wins: wins.get(unit.id) || 0 })),
    }
  }

  const hasUsableScoreboard = (payload) => !kitchenOnly
    || payload?.units?.some((unit) => typeof unit.kitchenMinutes === 'number')

  const requireUsableScoreboard = (payload) => {
    if (!hasUsableScoreboard(payload)) throw new Error('A Saipos não devolveu os tempos da cozinha agora.')
    return payload
  }

  const refreshScoreboard = async () => {
    const payload = dailyRanking
      ? await loadDailyRanking(new AbortController().signal, true)
      : requireUsableScoreboard(await loadScoreboard(new AbortController().signal, true))
    await saveCompetitionCache(period, date, metric, payload)
    return payload
  }

  const cached = await readCompetitionCache(period, date, metric)
  const usableCached = cached && (dailyRanking || hasUsableScoreboard(cached))

  // Depois das 23h40, o último placar salvo vira o resultado oficial do dia.
  // Mesmo uma chamada de atualização não deve alterar esse resultado.
  if (forceRefresh && scoreboardClosed && usableCached) {
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=90')
    return res.status(200).json({ ...cached, cached: true, closed: true })
  }

  // A TV inicia esta consulta antes da troca visual. Diferente do fluxo normal,
  // ela precisa esperar dados novos em vez de receber o cache atual.
  if (forceRefresh) {
    const controller = new AbortController()
    req.on?.('close', () => controller.abort())
    try {
      const payload = dailyRanking
        ? await loadDailyRanking(controller.signal, true)
        : requireUsableScoreboard(await loadScoreboard(controller.signal, true))
      await saveCompetitionCache(period, date, metric, payload)
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json(payload)
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar a competição.' })
    }
  }

  // Não use o cache "latest": ele pode pertencer a outro mês e misturar o
  // placar atual com as vendas do mês anterior.
  if (usableCached) {
    if (!scoreboardClosed) waitUntil(refreshScoreboard().catch(() => undefined))
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=90')
    if (dailyRanking) return res.status(200).json({ ...cached, cached: true })
    return res.status(200).json({
      ...cached,
      date,
      units: Array.isArray(cached.units)
        ? cached.units.map(({ id, name, orders, kitchenMinutes: averageKitchenMinutes }) => ({ id, name, orders, kitchenMinutes: averageKitchenMinutes }))
        : [],
      cached: true,
      closed: scoreboardClosed,
      stale: cached.date !== date,
    })
  }

  const controller = new AbortController()
  req.on?.('close', () => controller.abort())
  try {
    const payload = dailyRanking
      ? await loadDailyRanking(controller.signal)
      : requireUsableScoreboard(await loadScoreboard(controller.signal))
    await saveCompetitionCache(period, date, metric, payload)
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=90')
    res.status(200).json(payload)
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar a competição.' })
  }
}
