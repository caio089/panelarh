import { getSaiposKdsOrderDetails, getSaiposReport, shiftIsoDate, todayInFortaleza } from '../server/saiposDirceu.js'
import { saiposUnit } from '../server/saiposUnits.js'
import { readKdsCache, saveKdsCache } from '../server/kdsCache.js'
import { waitUntil } from '@vercel/functions'

// A TV consulta a cada 30 s. Uma janela um pouco menor garante que cada
// consulta programada realmente busque o estado atual na Saipos.
const SOURCE_REFRESH_MS = 25 * 1000
const RETRY_MS = 120_000
const workByUnit = new Map()

function cacheIsFresh(payload, now = Date.now()) {
  const fetchedAt = Date.parse(payload?.fetchedAt || '')
  return Number.isFinite(fetchedAt) && now - fetchedAt < SOURCE_REFRESH_MS
}

async function loadFresh(unit, today) {
  const signal = AbortSignal.timeout(90_000)
  const preparingOrders = []
  let urgentAfterMinutes = 15
  const missingDays = []
  // O turno atravessa a meia-noite. Só o resultado dos dois dias entra no cache compartilhado.
  for (const day of [shiftIsoDate(today, -1), today]) {
    try {
      const options = { date: day, token: unit.token(), signal, fresh: true, cacheScope: unit.id }
      const payload = await getSaiposReport({ ...options, category: 'cozinha', period: 'dia', unit: unit.name })
      urgentAfterMinutes = payload.report.urgentAfterMinutes
      const preparing = payload.report.queue.filter((order) => order.status === 'Cozinha')
      if (preparing.length === 0) continue
      const details = await getSaiposKdsOrderDetails(options)
      for (const order of preparing) {
        const detail = details.get(order.code)
        if (detail?.include === false) continue
        preparingOrders.push({ ...order, ...detail })
      }
    } catch (error) {
      missingDays.push(day)
      if (missingDays.length === 2) throw error
    }
  }
  const byCode = new Map(preparingOrders.map((order) => [order.code, order]))
  const queue = [...byCode.values()]
    .sort((a, b) => (b.waitingMinutes ?? -1) - (a.waitingMinutes ?? -1) || a.code.localeCompare(b.code))
    .slice(0, 30)
    .map(({ include: _include, ...order }) => order)
  const response = {
    unit: unit.name,
    date: today,
    fetchedAt: new Date().toISOString(),
    active: queue.length,
    preparing: queue.length,
    waiting: 0,
    onTheWay: 0,
    urgent: queue.filter((order) => order.urgent).length,
    urgentAfterMinutes,
    queue,
  }
  if (missingDays.length) return { ...response, partial: true, warning: `Fila parcial. Turno de ${missingDays[0].split('-').reverse().join('/')} indisponível.` }
  await saveKdsCache(unit.id, today, response)
  return response
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })

  const unitId = typeof req.query?.unidade === 'string' ? req.query.unidade.trim().toLowerCase() : ''
  const unit = saiposUnit(unitId)
  if (!unit) return res.status(404).json({ error: 'Unidade não encontrada.' })
  const today = todayInFortaleza()
  let state = workByUnit.get(unitId)
  if (state?.date !== today) {
    state = { date: today, snapshot: null, pending: null, retryAt: 0, error: '' }
    workByUnit.set(unitId, state)
  }
  if (!cacheIsFresh(state.snapshot)) {
    const regional = await readKdsCache(unit.id, today)
    if (regional && (!state.snapshot || Date.parse(regional.fetchedAt) > Date.parse(state.snapshot.fetchedAt))) {
      state.snapshot = regional
    }
  }
  const cached = state.snapshot
  if (cached && !cached.partial && cacheIsFresh(cached)) return res.status(200).json({ ...cached, cached: true, stale: false })

  if (!state.pending && Date.now() >= state.retryAt) {
    state.pending = loadFresh(unit, today).then((snapshot) => {
      if (snapshot.partial) {
        if (!state.snapshot || state.snapshot.partial) state.snapshot = snapshot
        state.error = snapshot.warning
        state.retryAt = Date.now() + RETRY_MS
        return state.snapshot
      }
      state.snapshot = snapshot
      state.error = ''
      state.retryAt = 0
      return snapshot
    }).catch((error) => {
      state.retryAt = Date.now() + RETRY_MS
      state.error = error instanceof Error ? error.message : 'Não foi possível consultar o KDS agora.'
      throw error
    }).finally(() => { state.pending = null })
    if (cached) waitUntil(state.pending.catch(() => undefined))
  }

  if (cached) return res.status(200).json({ ...cached, cached: true, stale: true, warning: state.error || undefined })
  if (state.pending) {
    try {
      const snapshot = await state.pending
      return res.status(200).json({ ...snapshot, cached: false, stale: Boolean(snapshot.partial) })
    } catch {
      // Responde com o mesmo intervalo para todas as telas que aguardavam a consulta.
    }
  }
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((state.retryAt - Date.now()) / 1000))))
  return res.status(503).json({ error: state.error })
}
