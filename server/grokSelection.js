import { attachResumes, resumeReadLabel } from './resumeForSelection.js'

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
      curriculoUrl: String(person?.curriculoUrl || person?.curriculo_url || '').slice(0, 500),
    }
  })
}

function parseRanking(text, people) {
  const allowedIds = new Set(people.map((person) => person.id))
  const byId = new Map(people.map((person) => [person.id, person]))
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
    const person = byId.get(id)
    const reasonsWithResume = reasons.length ? reasons : ['A Groq não detalhou este cruzamento.']
    ranking.push({
      id,
      score,
      reasons: reasonsWithResume,
      leuCurriculo: Boolean(person?.curriculoLido),
      curriculoFonte: person?.curriculoFonte || 'sem_arquivo',
    })
  }
  for (const id of allowedIds) {
    if (seen.has(id)) continue
    const person = byId.get(id)
    ranking.push({
      id,
      score: 0,
      reasons: ['A Groq não devolveu uma nota para esta pessoa.'],
      leuCurriculo: Boolean(person?.curriculoLido),
      curriculoFonte: person?.curriculoFonte || 'sem_arquivo',
    })
  }
  ranking.sort((a, b) => b.score - a.score)
  const lidos = people.filter((person) => person.curriculoLido).length
  const summaryBase = clip(parsed.summary, 700) || 'A Groq cruzou as candidaturas com o que a vaga pede.'
  const summary =
    people.length === 0
      ? summaryBase
      : `${summaryBase} Currículos lidos: ${lidos} de ${people.length}.`
  return { summary, ranking }
}

function peopleForModel(people) {
  return people.map((person) => ({
    id: person.id,
    nome: person.nome,
    experiencia: person.experiencia,
    respostas: person.respostas,
    curriculo: person.curriculo || '',
    curriculoLido: Boolean(person.curriculoLido),
    curriculoSituacao: resumeReadLabel(person.curriculoFonte),
  }))
}

export async function rankWithGrok(body, apiKey) {
  const key = String(apiKey || '').trim()
  if (!key) {
    throw new SelectionError('A Groq ainda não está ligada neste ambiente. Falta a chave.', 503)
  }
  const vaga = jobBrief(body?.vaga)
  const pessoas = await attachResumes(peopleBrief(body?.candidatos), key)
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
              'Você faz a seleção da Panela Velha, restaurante em Teresina, usando a Groq. Cruze o que a vaga pede com a ficha E com o currículo lido. Se curriculoLido for true, use o campo curriculo; isso pesa mais do que um texto vago da ficha. Não invente emprego que não está na ficha nem no currículo. Se não leu currículo, deixe isso claro nos motivos. Não cite CPF, telefone ou dado bancário. Responda em português, apenas com JSON: {"summary":"texto curto","ranking":[{"id":"id recebido","score":0,"reasons":["motivo concreto"]}]}. score de 0 a 100. Inclua todas as pessoas recebidas.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              vaga,
              quantasAvancam: count,
              pessoas: peopleForModel(pessoas),
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
  return parseRanking(text, pessoas)
}
