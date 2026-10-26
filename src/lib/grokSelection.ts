import type { Candidato, Vaga } from '@/types'
import { rowsFromCandidatoInfo } from '@/lib/candidatoInfo'

export type GrokRank = {
  id: string
  score: number
  reasons: string[]
}

export type GrokSelection = {
  summary: string
  ranking: GrokRank[]
}

const SENSITIVE = /^(cpf|whatsapp|telefone|phone|banco|conta|ag[eê]ncia)$/i

/** O que o Grok pode ler: experiência e respostas da vaga, sem documento nem telefone. */
export function answersForGrok(info?: string | null) {
  return rowsFromCandidatoInfo(info)
    .filter(([label]) => !SENSITIVE.test(label))
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')
}

export async function requestGrokSelection(input: {
  count: number
  vaga: Vaga
  candidatos: Candidato[]
}): Promise<GrokSelection> {
  const response = await fetch('/api/selecao', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      count: input.count,
      vaga: {
        titulo: input.vaga.titulo,
        descricao: input.vaga.descricao,
        localidade: input.vaga.localidade,
        horario: input.vaga.horario,
        regime: input.vaga.regime,
        responsabilidades: input.vaga.responsabilidades,
        requisitos: input.vaga.requisitos,
        diferenciais: input.vaga.diferenciais,
        beneficios: input.vaga.beneficios,
      },
      candidatos: input.candidatos.map((candidato) => ({
        id: candidato.id,
        nome: candidato.nome,
        experiencia: candidato.experiencia,
        respostas: answersForGrok(candidato.info_complementar),
      })),
    }),
  })
  const payload = (await response.json().catch(() => null)) as { error?: string; summary?: string; ranking?: GrokRank[] } | null
  if (!response.ok) {
    throw new Error(payload?.error || 'A Groq não conseguiu cruzar as candidaturas.')
  }
  if (!payload?.ranking?.length) throw new Error('A Groq não devolveu o cruzamento.')
  return { summary: payload.summary || '', ranking: payload.ranking }
}
