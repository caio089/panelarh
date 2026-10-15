import type { Candidato, Profile, Vaga } from '@/types'
import { rowsFromCandidatoInfo } from '@/lib/candidatoInfo'

/** Score de match cruzando perfil do candidato com requisitos da vaga */
export function scoreCandidateForVaga(
  candidato: Candidato,
  vaga: Vaga,
  profile?: Profile | null,
  experiencesCount = 0,
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 42

  const titulo = (vaga.titulo || '').toLowerCase()
  const desired = (profile?.desired_role || '').toLowerCase()
  const expText = (candidato.experiencia || '').toLowerCase()

  if (desired && (titulo.includes(desired) || desired.includes(titulo.split(' ')[0] || ''))) {
    score += 18
    reasons.push('Cargo desejado alinhado à vaga')
  } else if (expText && titulo.split(' ').some((w) => w.length > 3 && expText.includes(w))) {
    score += 12
    reasons.push('Experiência mencionada combina com a vaga')
  }

  if (experiencesCount >= 1) {
    score += 8
    reasons.push('Histórico profissional preenchido')
  }
  if (experiencesCount >= 2) {
    score += 6
    reasons.push('Múltiplas experiências relevantes')
  }

  const answer = (label: string) =>
    rowsFromCandidatoInfo(candidato.info_complementar).find(
      ([name]) => name.toLowerCase() === label.toLowerCase(),
    )?.[1] || ''

  if (/^sim\b/i.test(answer('Restaurante'))) {
    score += 12
    reasons.push('Já trabalhou em restaurante')
  }
  const start = answer('Começa')
  if (/^hoje\b/i.test(start)) {
    score += 8
    reasons.push('Pode começar hoje')
  } else if (/semana/i.test(start)) {
    score += 5
    reasons.push('Pode começar nesta semana')
  }
  const weekend = answer('Fim de semana') || answer('FDS')
  if (/^sim\b/i.test(weekend)) {
    score += 6
    reasons.push('Disponível no fim de semana')
  }

  if (candidato.status === 'entrevista') {
    score += 8
    reasons.push('Já avançou para entrevista')
  } else if (candidato.status === 'aprovada') {
    score += 12
    reasons.push('Já aprovado no pipeline')
  } else if (candidato.status === 'pendente') {
    score += 3
  } else if (candidato.status === 'reprovada') {
    score -= 25
    reasons.push('Status atual: reprovado')
  }

  if (profile?.availability) {
    score += 4
    reasons.push('Disponibilidade informada')
  }
  if (profile?.phone) {
    score += 2
  }

  // leve variação “modelo”
  const hash = [...candidato.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  score += hash % 7

  score = Math.max(5, Math.min(98, Math.round(score)))
  if (reasons.length === 0) reasons.push('Perfil geral avaliado pela IA')

  return { score, reasons: reasons.slice(0, 6) }
}

export type SelectionPick = {
  nome: string
  score: number
  reasons: string[]
}

/** Texto da IA explicando o corte: por que estes N avançaram. */
export function explainSelection(input: {
  vagaTitle: string
  requested: number
  poolSize: number
  selected: SelectionPick[]
  nextOut?: SelectionPick | null
}): { headline: string; summary: string; picks: string[] } {
  const n = input.selected.length
  const vaga = input.vagaTitle || 'esta vaga'
  const asked = Math.max(1, input.requested)

  let summary = `Você pediu ${asked} pessoa${asked === 1 ? '' : 's'} para a vaga ${vaga}. `
  if (input.poolSize <= n) {
    summary += `Há ${input.poolSize} candidato${input.poolSize === 1 ? '' : 's'} no processo — todos avançaram neste corte.`
  } else {
    summary += `Entre ${input.poolSize} candidatos, a IA ficou com ${n}: melhor cruzamento de experiência, horário e o que a vaga pede.`
  }

  if (input.nextOut && n < input.poolSize) {
    summary += ` O próximo da fila (${input.nextOut.nome}, ${input.nextOut.score}%) ficou de fora neste corte.`
  }

  const picks = input.selected.map((pick, idx) => {
    const why = pick.reasons.length
      ? pick.reasons.join('; ').replace(/; $/, '')
      : 'perfil geral compatível com a vaga'
    return `${idx + 1}. ${pick.nome} (${pick.score}%) — ${why}.`
  })

  return {
    headline: n === 1 ? 'Por que a IA escolheu esta pessoa' : `Por que a IA escolheu estas ${n} pessoas`,
    summary,
    picks,
  }
}

export function phoneToWhatsApp(phone?: string | null) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return withCountry
}

export function buildWhatsAppUrl(phone: string, message: string) {
  const n = phoneToWhatsApp(phone)
  if (!n) return null
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`
}
