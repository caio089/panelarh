import { pipeDirceuReport } from '../server/saiposDirceu.js'
import { saiposUnit } from '../server/saiposUnits.js'
import { isAdminRequest } from '../server/staffAccess.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' })
  if (!isAdminRequest(req)) return res.status(401).json({ error: 'Acesso restrito ao admin.' })

  const unit = saiposUnit(typeof req.query?.unidade === 'string' ? req.query.unidade : '')
  if (!unit) return res.status(400).json({ error: 'Unidade Saipos inválida.' })
  const controller = new AbortController()
  req.on?.('close', () => {
    if (!res.writableEnded) controller.abort()
  })
  await pipeDirceuReport(
    typeof req.query?.dia === 'string' ? req.query.dia : '',
    typeof req.query?.categoria === 'string' ? req.query.categoria : '',
    unit.token(),
    controller.signal,
    typeof req.query?.periodo === 'string' ? req.query.periodo : 'dia',
    res,
    req.query?.atualiza === '1',
    unit.name,
    unit.id,
  )
}
