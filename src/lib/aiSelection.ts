import type { Candidato, Profile, Vaga } from '@/types'

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

  const d = Number(profile?.disc_d || 0)
  const i = Number(profile?.disc_i || 0)
  const s = Number(profile?.disc_s || 0)
  const c = Number(profile?.disc_c || 0)

  if (titulo.includes('gerente') || titulo.includes('líder')) {
    if (d >= 60) {
      score += 10
      reasons.push('DISC com alta Dominância (liderança)')
    }
    if (c >= 60) {
      score += 6
      reasons.push('Alta Conformidade para processos')
    }
  } else if (titulo.includes('garçom') || titulo.includes('atendente') || titulo.includes('caixa')) {
    if (i >= 60) {
      score += 10
      reasons.push('DISC com alta Influência (atendimento)')
    }
    if (s >= 55) {
      score += 5
      reasons.push('Estabilidade para ritmo de salão')
    }
  } else {
    // cozinha / chapeiro / auxiliar
    if (c >= 55) {
      score += 8
      reasons.push('Atenção a padrão e qualidade (DISC C)')
    }
    if (d >= 50) {
      score += 6
      reasons.push('Ritmo e decisão sob pressão (DISC D)')
    }
    if (s >= 60) {
      score += 4
      reasons.push('Consistência operacional (DISC S)')
    }
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
    summary += `Entre ${input.poolSize} candidatos, a IA ficou com ${n}: melhor cruzamento de cargo, DISC, experiência e o que a vaga pede.`
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
