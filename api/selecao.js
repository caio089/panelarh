import { rankWithGrok, SelectionError } from '../server/grokSelection.js'
import { isStaffRequest } from '../server/staffAccess.js'

function readJson(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body)
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 200_000) {
        reject(new SelectionError('A análise passou do tamanho permitido.', 413))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new SelectionError('Não entendi os dados da seleção.', 400))
      }
    })
    req.on('error', () => reject(new SelectionError('Falha ao ler a seleção.', 400)))
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' })
    return
  }
  if (!isStaffRequest(req)) {
    res.status(401).json({ error: 'Acesso restrito ao RH.' })
    return
  }
  try {
    const body = await readJson(req)
    const result = await rankWithGrok(body, process.env.GROQ_API_KEY || '')
    res.status(200).json(result)
  } catch (error) {
    const status = error instanceof SelectionError ? error.statusCode : 500
    res.status(status).json({
      error: error instanceof Error ? error.message : 'O Grok não conseguiu analisar agora.',
    })
  }
}
