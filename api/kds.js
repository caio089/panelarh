import { getSaiposReport, todayInFortaleza } from '../server/saiposDirceu.js'
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
  const date = todayInFortaleza()
  const cached = await readKdsCache(unit.id, date)
  if (cached && cacheIsFresh(cached)) {
    return res.status(200).json({ ...cached, cached: true, stale: false })
  }

  const loadFresh = async (signal) => {
    const payload = await getSaiposReport({
      date,
      category: 'cozinha',
      period: 'dia',
      token: unit.token(),
      signal,
      fresh: true,
      unit: unit.name,
      cacheScope: unit.id,
    })
    const report = payload.report || {}
    const response = {
      unit: unit.name,
      fetchedAt: payload.fetchedAt,
      active: report.active || 0,
      preparing: report.preparing || 0,
      waiting: report.waiting || 0,
      onTheWay: report.onTheWay || 0,
      urgent: report.urgent || 0,
      urgentAfterMinutes: report.urgentAfterMinutes || 15,
      queue: Array.isArray(report.queue) ? report.queue.slice(0, 30) : [],
    }
    await saveKdsCache(unit.id, date, response)
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
