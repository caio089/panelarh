import { getSaiposReport, todayInFortaleza } from '../server/saiposDirceu.js'
import { SAIPOS_UNITS } from '../server/saiposUnits.js'

function kitchenMinutes(report) {
  const stages = Array.isArray(report?.stages) ? report.stages : []
  const cooking = stages.find((stage) => String(stage.label).trim().toLowerCase() === 'cozinha')
  return typeof cooking?.averageMinutes === 'number' ? cooking.averageMinutes : null
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })
  const today = todayInFortaleza()
  const requestedDate = typeof req.query?.dia === 'string' ? req.query.dia : ''
  const requestedPeriod = typeof req.query?.periodo === 'string' ? req.query.periodo : 'dia'
  const kitchenOnly = req.query?.dados === 'cozinha'
  if (requestedDate && (!isIsoDate(requestedDate) || requestedDate > today)) {
    return res.status(400).json({ error: 'Informe uma data válida até hoje.' })
  }
  if (requestedPeriod !== 'dia' && requestedPeriod !== 'mes') {
    return res.status(400).json({ error: 'Informe período dia ou mes.' })
  }
  const date = requestedDate || today
  const period = requestedPeriod
  const controller = new AbortController()
  req.on?.('close', () => controller.abort())

  try {
    const units = await Promise.all(
      Object.values(SAIPOS_UNITS).map(async (unit) => {
        if (kitchenOnly) {
          let kitchen = null
          try {
            kitchen = await getSaiposReport({ date, category: 'cozinha', token: unit.token(), signal: controller.signal, unit: unit.name, cacheScope: unit.id })
          } catch {
            // A tela já mostra as vendas; a cozinha será atualizada na próxima tentativa.
          }
          return { id: unit.id, name: unit.name, sales: 0, orders: 0, kitchenMinutes: kitchen ? kitchenMinutes(kitchen.report) : null }
        }
        const sales = await getSaiposReport({ date, category: 'faturamento', period, token: unit.token(), signal: controller.signal, unit: unit.name, cacheScope: unit.id })
        return {
          id: unit.id,
          name: unit.name,
          sales: sales.report.revenue,
          orders: sales.report.count,
          kitchenMinutes: null,
        }
      }),
    )
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    res.status(200).json({ date, period, fetchedAt: new Date().toISOString(), units })
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar a competição.' })
  }
}
