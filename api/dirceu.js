import { pipeDirceuReport } from '../server/saiposDirceu.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido.' })
    return
  }
  const dia = typeof req.query?.dia === 'string' ? req.query.dia : ''
  const categoria = typeof req.query?.categoria === 'string' ? req.query.categoria : ''
  const periodo = typeof req.query?.periodo === 'string' ? req.query.periodo : 'dia'
  const controller = new AbortController()
  req.on?.('close', () => {
    if (!res.writableEnded) controller.abort()
  })
  await pipeDirceuReport(dia, categoria, process.env.API_SAIPOS ?? '', controller.signal, periodo, res)
}
