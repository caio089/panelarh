const MODEL = 'openai/gpt-oss-120b'
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const SENSITIVE_LINE = /^(cpf|whatsapp|telefone|phone|banco|conta|ag[eê]ncia)\s*:/i

export class SelectionError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
  }
}

/** Tira documento, telefone e dado bancário antes de sair do nosso servidor. */
export function answersForModel(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !SENSITIVE_LINE.test(line))
    .join('\n')
    .slice(0, 1800)
}

function clip(value, max) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function jobBrief(vaga) {
  if (!vaga || typeof vaga !== 'object') throw new SelectionError('Informe a vaga.', 400)
  const titulo = clip(vaga.titulo, 120)
  if (titulo.length < 2) throw new SelectionError('Informe a vaga.', 400)
  return {
    titulo,
    descricao: clip(vaga.descricao, 800),
    localidade: clip(vaga.localidade, 120),
    horario: clip(vaga.horario, 160),
    regime: clip(vaga.regime, 40),
    responsabilidades: clip(vaga.responsabilidades, 800),
    requisitos: clip(vaga.requisitos, 800),
    diferenciais: clip(vaga.diferenciais, 400),
    beneficios: clip(vaga.beneficios, 400),
  }
}

function peopleBrief(candidatos) {
  if (!Array.isArray(candidatos) || candidatos.length === 0) {
    throw new SelectionError('Não há candidaturas para cruzar com a vaga.', 400)
  }
  if (candidatos.length > 40) throw new SelectionError('Envie no máximo 40 candidaturas por vez.', 400)
  return candidatos.map((person) => {
    const id = clip(person?.id, 80)
    const nome = clip(person?.nome, 80)
    if (!id || !nome) throw new SelectionError('Cada candidatura precisa de nome.', 400)
    return {
      id,
      nome,
      experiencia: clip(person?.experiencia, 800),
      respostas: answersForModel(person?.respostas),
    }
  })
}

function parseRanking(text, allowedIds) {
  const raw = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim()
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new SelectionError('A Groq não devolveu uma análise utilizável.', 502)
  }
  const rows = Array.isArray(parsed.ranking) ? parsed.ranking : []
  const ranking = []
  const seen = new Set()
  for (const row of rows) {
    const id = typeof row?.id === 'string' ? row.id : ''
    if (!allowedIds.has(id) || seen.has(id)) continue
    seen.add(id)
    const score = Math.max(0, Math.min(100, Math.round(Number(row.score) || 0)))
    const reasons = Array.isArray(row.reasons)
      ? row.reasons
          .filter((reason) => typeof reason === 'string' && reason.trim())
          .map((reason) => reason.trim().slice(0, 180))
          .slice(0, 4)
      : []
    ranking.push({
      id,
      score,
      reasons: reasons.length ? reasons : ['A Groq não detalhou este cruzamento.'],
    })
  }
  for (const id of allowedIds) {
    if (seen.has(id)) continue
    ranking.push({ id, score: 0, reasons: ['A Groq não devolveu uma nota para esta pessoa.'] })
  }
  ranking.sort((a, b) => b.score - a.score)
  return {
    summary: clip(parsed.summary, 700) || 'A Groq cruzou as candidaturas com o que a vaga pede.',
    ranking,
  }
}

export async function rankWithGrok(body, apiKey) {
  const key = String(apiKey || '').trim()
  if (!key) {
    throw new SelectionError('A Groq ainda não está ligada neste ambiente. Falta a chave.', 503)
  }
  const vaga = jobBrief(body?.vaga)
  const pessoas = peopleBrief(body?.candidatos)
  const count = Math.max(1, Math.min(pessoas.length, Number(body?.count) || 3))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 50000)
  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Você faz a seleção da Panela Velha, restaurante em Teresina, usando a Groq. Cruze só o que a vaga pede com o que cada pessoa respondeu. Não invente experiência. Não peça nem cite CPF, telefone ou dado bancário. Responda em português, apenas com JSON: {"summary":"texto curto","ranking":[{"id":"id recebido","score":0,"reasons":["motivo concreto"]}]}. score de 0 a 100. Inclua todas as pessoas recebidas.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              vaga,
              quantasAvancam: count,
              pessoas,
            }),
          },
        ],
      }),
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new SelectionError('A Groq demorou demais para responder.', 504)
    }
    throw new SelectionError('Não foi possível falar com a Groq.', 502)
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new SelectionError('A Groq não conseguiu analisar agora.', response.status === 401 ? 503 : 502)
  }
  const payload = await response.json()
  const message = payload?.choices?.[0]?.message
  const text = message?.content || message?.reasoning || ''
  return parseRanking(text, new Set(pessoas.map((person) => person.id)))
}
