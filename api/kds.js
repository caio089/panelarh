import { getSaiposReport, todayInFortaleza } from '../server/saiposDirceu.js'
import { saiposUnit } from '../server/saiposUnits.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })

  const unitId = typeof req.query?.unidade === 'string' ? req.query.unidade.trim().toLowerCase() : ''
  const unit = saiposUnit(unitId)
  if (!unit) return res.status(404).json({ error: 'Unidade não encontrada.' })

  const controller = new AbortController()
  req.on?.('close', () => controller.abort())
  try {
    const payload = await getSaiposReport({
      date: todayInFortaleza(),
      category: 'cozinha',
      period: 'dia',
      token: unit.token(),
      signal: controller.signal,
      fresh: true,
      unit: unit.name,
      cacheScope: unit.id,
    })
    const report = payload.report || {}
    return res.status(200).json({
      unit: unit.name,
      fetchedAt: payload.fetchedAt,
      active: report.active || 0,
      preparing: report.preparing || 0,
      waiting: report.waiting || 0,
      onTheWay: report.onTheWay || 0,
      urgent: report.urgent || 0,
      urgentAfterMinutes: report.urgentAfterMinutes || 20,
      queue: Array.isArray(report.queue) ? report.queue.slice(0, 16) : [],
    })
  } catch (error) {
    if (controller.signal.aborted) return
    return res.status(503).json({ error: error instanceof Error ? error.message : 'Não foi possível consultar o KDS agora.' })
  }
}
