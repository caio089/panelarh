import { getCache } from '@vercel/functions'
import { getSaiposCompetitionMetrics } from './saiposDirceu.js'

const cache = getCache({ namespace: 'panela-velha-competition-days' })
const memory = new Map()
const pending = new Map()

const CLOSED_DAY_TTL_SECONDS = 60 * 60 * 24
const OPEN_DAY_TTL_SECONDS = 90

function eachDay(start, end) {
  const days = []
  const cursor = new Date(`${start}T12:00:00Z`)
  const final = new Date(`${end}T12:00:00Z`)
  while (cursor <= final) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function isSnapshot(value) {
  return Boolean(value)
    && typeof value.orders === 'number'
    && typeof value.seconds === 'number'
    && typeof value.samples === 'number'
}

function averageMinutes(seconds, samples) {
  if (!samples) return null
  return Math.round((seconds / samples / 60) * 10) / 10
}

function remember(key, snapshot, ttlSeconds) {
  memory.set(key, { snapshot, expiresAt: Date.now() + ttlSeconds * 1000 })
}

async function readDay(unitId, day) {
  const key = `${unitId}:${day}`
  const local = memory.get(key)
  if (local && local.expiresAt > Date.now() && isSnapshot(local.snapshot)) return local.snapshot
  try {
    const value = await cache.get(`v1:${key}`)
    if (!isSnapshot(value)) return null
    remember(key, value, OPEN_DAY_TTL_SECONDS)
    return value
  } catch {
    return null
  }
}

async function writeDay(unitId, day, snapshot, closed) {
  const key = `${unitId}:${day}`
  const ttl = closed ? CLOSED_DAY_TTL_SECONDS : OPEN_DAY_TTL_SECONDS
  remember(key, snapshot, ttl)
  try {
    await cache.set(`v1:${key}`, snapshot, {
      ttl,
      tags: ['competition-day', unitId],
      name: 'competition-day',
    })
  } catch {
    // A próxima chamada desta instância ainda encontra o dia na memória.
  }
}

async function loadDay({ unitId, day, token, signal, fresh, closed }) {
  if (!fresh) {
    const cached = await readDay(unitId, day)
    if (cached) return cached
  }
  const key = `${unitId}:${day}`
  const current = pending.get(key)
  if (current) return current

  const task = (async () => {
    const metrics = await getSaiposCompetitionMetrics({
      start: day,
      end: day,
      token,
      signal,
      fresh,
      cacheScope: unitId,
    })
    const totals = metrics.dailyKitchenTotals?.[day] || { seconds: 0, samples: 0 }
    const snapshot = {
      orders: metrics.counts.get(day) || 0,
      seconds: totals.seconds,
      samples: totals.samples,
    }
    await writeDay(unitId, day, snapshot, closed)
    return snapshot
  })().finally(() => pending.delete(key))

  pending.set(key, task)
  return task
}

function summarize(days, snapshots) {
  let orders = 0
  let seconds = 0
  let samples = 0
  const series = days.map((day) => {
    const snapshot = snapshots.get(day)
    if (!snapshot) return { date: day, orders: 0, kitchenMinutes: null }
    orders += snapshot.orders
    seconds += snapshot.seconds
    samples += snapshot.samples
    return {
      date: day,
      orders: snapshot.orders,
      kitchenMinutes: averageMinutes(snapshot.seconds, snapshot.samples),
    }
  })
  return { orders, kitchenMinutes: averageMinutes(seconds, samples), days: series }
}

/**
 * O mês inteiro não cabe numa resposta: cada dia pede vendas e histórico.
 * Esta chamada baixa no máximo um dia que ainda não está em cache e deixa
 * o restante para continuar depois que a TV já recebeu o 200.
 */
export async function loadCompetitionSpan({ unitId, token, start, end, today, signal, fresh = false }) {
  const days = eachDay(start, end)
  const snapshots = new Map()
  const missing = []

  for (const day of days) {
    const closed = day < today
    const cached = fresh && day === end ? null : await readDay(unitId, day)
    if (cached) snapshots.set(day, cached)
    else missing.push(day)
  }

  const nextDay = missing[0]
  let failed = false
  if (nextDay) {
    if (signal?.aborted) throw new DOMException('Consulta cancelada.', 'AbortError')
    try {
      const snapshot = await loadDay({
        unitId,
        day: nextDay,
        token,
        signal,
        fresh: fresh && nextDay === end,
        closed: nextDay < today,
      })
      snapshots.set(nextDay, snapshot)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error
      if (snapshots.size === 0) throw error
      failed = true
    }
  }

  const stillMissing = failed ? [] : days.filter((day) => !snapshots.has(day))
  const partial = days.some((day) => !snapshots.has(day))
  const totals = summarize(days, snapshots)

  return {
    partial,
    orders: totals.orders,
    kitchenMinutes: totals.kitchenMinutes,
    days: totals.days,
    fill: stillMissing.length === 0
      ? null
      : () => fillDays({ unitId, token, today, days: stillMissing }),
  }
}

async function fillDays({ unitId, token, today, days }) {
  for (const day of days) {
    try {
      await loadDay({
        unitId,
        day,
        token,
        signal: undefined,
        fresh: false,
        closed: day < today,
      })
    } catch {
      return
    }
  }
}
