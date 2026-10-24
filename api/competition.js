import { getSaiposReport, todayInFortaleza } from '../server/saiposDirceu.js'
import { SAIPOS_UNITS } from '../server/saiposUnits.js'

function kitchenMinutes(report) {
  const stages = Array.isArray(report?.stages) ? report.stages : []
  const cooking = stages.find((stage) => String(stage.label).trim().toLowerCase() === 'cozinha')
  return typeof cooking?.averageMinutes === 'number' ? cooking.averageMinutes : null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })
  const date = todayInFortaleza()
  const controller = new AbortController()
  req.on?.('close', () => controller.abort())

  try {
    const units = await Promise.all(
      Object.values(SAIPOS_UNITS).map(async (unit) => {
        const [sales, kitchen] = await Promise.all([
          getSaiposReport({ date, category: 'faturamento', token: unit.token(), signal: controller.signal, unit: unit.name, cacheScope: unit.id }),
          getSaiposReport({ date, category: 'cozinha', token: unit.token(), signal: controller.signal, unit: unit.name, cacheScope: unit.id }),
        ])
        return {
          id: unit.id,
          name: unit.name,
          sales: sales.report.revenue,
          orders: sales.report.count,
          kitchenMinutes: kitchenMinutes(kitchen.report),
        }
      }),
    )
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    res.status(200).json({ date, fetchedAt: new Date().toISOString(), units })
  } catch (error) {
    res.status(503).json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar a competição.' })
  }
}
