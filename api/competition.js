import { waitUntil } from '@vercel/functions'
import { todayInFortaleza } from '../server/saiposDirceu.js'
import { saiposUnit } from '../server/saiposUnits.js'
import { competitionDayPayload, loadCompetitionDay, loadCompetitionSpan } from '../server/competitionDays.js'

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function cachePublicResult(res, seconds) {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate')
  res.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${seconds}`)
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })
  const today = todayInFortaleza()
  const requestedDate = typeof req.query?.dia === 'string' ? req.query.dia : ''
  const requestedStart = typeof req.query?.inicio === 'string' ? req.query.inicio : ''
  const requestedEnd = typeof req.query?.fim === 'string' ? req.query.fim : ''
  const requestedPeriod = typeof req.query?.periodo === 'string' ? req.query.periodo : 'dia'
  const requestedUnit = typeof req.query?.unidade === 'string' ? req.query.unidade.trim().toLowerCase() : ''
  const dailyRanking = req.query?.modo === 'diario'
  const kitchenOnly = req.query?.dados === 'cozinha' && !dailyRanking
  const fresh = req.query?.atualiza === '1'
  const unit = saiposUnit(requestedUnit)
  if (typeof unit?.token !== 'function') return res.status(400).json({ error: 'Informe a unidade.' })
  if (requestedDate && (!isIsoDate(requestedDate) || requestedDate > today)) {
    return res.status(400).json({ error: 'Informe uma data válida até hoje.' })
  }
  if (!dailyRanking && requestedPeriod !== 'dia' && requestedPeriod !== 'mes' && requestedPeriod !== 'intervalo') {
    return res.status(400).json({ error: 'Informe período dia, mes ou intervalo.' })
  }
  if (requestedPeriod === 'intervalo' && (
    !isIsoDate(requestedStart) || !isIsoDate(requestedEnd) ||
    requestedStart > requestedEnd || requestedEnd > today ||
    (Date.parse(requestedEnd) - Date.parse(requestedStart)) / 86_400_000 > 365
  )) return res.status(400).json({ error: 'Informe um intervalo válido de até 366 dias, sem datas futuras.' })

  const period = dailyRanking ? 'mes' : requestedPeriod
  const date = period === 'mes' ? today : requestedDate || today
  const token = unit.token()
  if (!token.trim()) return res.status(503).json({ error: `A chave da Saipos para ${unit.name} não está configurada no servidor.` })

  const identity = { id: unit.id, name: unit.name }
  const options = { unitId: unit.id, token, today, kitchenOnly, fresh }
  try {
    if (period === 'mes' || period === 'intervalo') {
      const start = period === 'intervalo' ? requestedStart : `${date.slice(0, 7)}-01`
      const end = period === 'intervalo' ? requestedEnd : date
      const span = await loadCompetitionSpan({ ...options, start, end })
      if (span.fill) waitUntil(span.fill().catch(() => undefined))
      if (!fresh && period === 'mes' && requestedDate === today && !span.partial && !span.stale) cachePublicResult(res, 60)
      return res.status(200).json({
        date: end,
        period,
        ...(period === 'intervalo' ? { start, end, observedOrders: span.observedOrders, observedKitchenMinutes: span.observedKitchenMinutes } : {}),
        ...(span.fetchedAt ? { fetchedAt: new Date(span.fetchedAt).toISOString() } : {}),
        partial: span.partial,
        stale: span.stale,
        coverage: span.coverage,
        unit: { ...identity, orders: span.orders, kitchenMinutes: span.kitchenMinutes },
        ...(dailyRanking && span.days ? { days: span.days } : {}),
      })
    }

    const result = await loadCompetitionDay({ ...options, day: date })
    if (result.refresh) waitUntil(result.refresh().catch(() => undefined))
    if (!fresh && requestedDate && !result.stale && !result.error) cachePublicResult(res, 30)
    return res.status(200).json({
      date,
      period,
      fetchedAt: new Date(result.snapshot.fetchedAt).toISOString(),
      stale: result.stale,
      ...(result.error ? { error: result.error } : {}),
      unit: { ...identity, ...competitionDayPayload(result.snapshot, kitchenOnly) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível atualizar a competição.'
    return res.status(503).json({ error: message })
  }
}
