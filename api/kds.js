import { getSaiposReport, todayInFortaleza } from '../server/saiposDirceu.js'
import { authorizeTvUnit } from '../server/tvAccess.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vary', 'Authorization')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })

  const unitId = typeof req.query?.unidade === 'string' ? req.query.unidade.trim().toLowerCase() : ''
  const access = await authorizeTvUnit(req, unitId)
  if (!access.unit) return res.status(access.status || 403).json({ error: access.error || 'Acesso negado.' })

  const controller = new AbortController()
  req.on?.('close', () => controller.abort())
  try {
    const payload = await getSaiposReport({
      date: todayInFortaleza(),
      category: 'cozinha',
      period: 'dia',
      token: access.unit.token(),
      signal: controller.signal,
      fresh: true,
      unit: access.unit.name,
      cacheScope: access.unit.id,
    })
    const report = payload.report || {}
    return res.status(200).json({
      unit: access.unit.name,
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
