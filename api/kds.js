import { getSaiposKdsOrderDetails, getSaiposReport, shiftIsoDate, todayInFortaleza } from '../server/saiposDirceu.js'
import { saiposUnit } from '../server/saiposUnits.js'
import { readKdsCache, saveKdsCache } from '../server/kdsCache.js'
import { waitUntil } from '@vercel/functions'

// A TV consulta a cada 30 s. Uma janela um pouco menor garante que cada
// consulta programada realmente busque o estado atual na Saipos.
const SOURCE_REFRESH_MS = 25 * 1000

function cacheIsFresh(payload, now = Date.now()) {
  const fetchedAt = Date.parse(payload?.fetchedAt || '')
  return Number.isFinite(fetchedAt) && now - fetchedAt < SOURCE_REFRESH_MS
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })

  const unitId = typeof req.query?.unidade === 'string' ? req.query.unidade.trim().toLowerCase() : ''
  const unit = saiposUnit(unitId)
  if (!unit) return res.status(404).json({ error: 'Unidade não encontrada.' })
  const today = todayInFortaleza()
  // O turno da noite continua com a data de ontem até o dia seguinte começar.
  // Os dois dias entram para o almoço não sumir enquanto a noite ainda está aberta.
  const days = [shiftIsoDate(today, -1), today]
  const cached = await readKdsCache(unit.id, today)
  if (cached && cacheIsFresh(cached)) {
    return res.status(200).json({ ...cached, cached: true, stale: false })
  }

  const loadFresh = async (signal) => {
    const preparingOrders = []
    let fetchedAt = new Date().toISOString()
    let urgentAfterMinutes = 15
    let loadedDays = 0
    let failedDay = null
    for (const day of days) {
      try {
        const [payload, orderDetails] = await Promise.all([
          getSaiposReport({
            date: day,
            category: 'cozinha',
            period: 'dia',
            token: unit.token(),
            signal,
            fresh: true,
            unit: unit.name,
            cacheScope: unit.id,
          }),
          getSaiposKdsOrderDetails({ date: day, token: unit.token(), signal, fresh: true, cacheScope: unit.id }),
        ])
        fetchedAt = payload.fetchedAt || fetchedAt
        urgentAfterMinutes = payload.report?.urgentAfterMinutes || urgentAfterMinutes
        const queue = Array.isArray(payload.report?.queue) ? payload.report.queue : []
        for (const order of queue) {
          const detailed = { ...order, ...orderDetails.get(order.code) }
          // Sai do quadro assim que a Saipos tira de Cozinha (entrega, finalizado ou cancelado).
          if (detailed.status !== 'Cozinha' || detailed.include === false) continue
          preparingOrders.push(detailed)
        }
        loadedDays += 1
      } catch (error) {
        if (signal?.aborted) throw error
        failedDay = error
      }
    }
    if (loadedDays === 0 && failedDay) throw failedDay
    const byCode = new Map(preparingOrders.map((order) => [order.code, order]))
    const queue = [...byCode.values()]
      .sort((a, b) => (b.waitingMinutes ?? -1) - (a.waitingMinutes ?? -1) || a.code.localeCompare(b.code))
      .slice(0, 30)
      .map(({ include: _include, ...order }) => order)
    const response = {
      unit: unit.name,
      date: today,
      fetchedAt,
      active: queue.length,
      preparing: queue.length,
      waiting: 0,
      onTheWay: 0,
      urgent: queue.filter((order) => order.urgent).length,
      urgentAfterMinutes,
      queue,
    }
    await saveKdsCache(unit.id, today, response)
    return response
  }

  // A consulta completa pode percorrer muitas páginas da Saipos. Se já existe
  // um dado válido, a TV o recebe imediatamente enquanto o refresh acontece
  // em segundo plano; no ciclo seguinte ela já recebe o resultado novo.
  if (cached) {
    waitUntil(loadFresh(new AbortController().signal).catch(() => undefined))
    return res.status(200).json({ ...cached, cached: true, stale: true })
  }

  const controller = new AbortController()
  req.on?.('close', () => controller.abort())
  try {
    const response = await loadFresh(controller.signal)
    return res.status(200).json({ ...response, cached: false, stale: false })
  } catch (error) {
    if (controller.signal.aborted) return
    const message = error instanceof Error ? error.message : 'Não foi possível consultar o KDS agora.'
    res.setHeader('Retry-After', '120')
    return res.status(503).json({ error: message })
  }
}
