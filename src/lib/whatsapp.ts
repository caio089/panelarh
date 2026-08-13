import type { CandidateStatus } from '@/types'
import { buildWhatsAppUrl, phoneToWhatsApp } from '@/lib/aiSelection'
import { formatDateBR } from '@/lib/utils'

export { buildWhatsAppUrl, phoneToWhatsApp }

/** Abre o WhatsApp com a mensagem pronta. Sem API paga — usa o app/web do RH. */
export function openWhatsAppChat(phone: string | null | undefined, message: string) {
  const url = phone ? buildWhatsAppUrl(phone, message) : null
  if (!url) {
    return { error: 'Este candidato não tem WhatsApp cadastrado.' }
  }
  window.open(url, '_blank', 'noopener,noreferrer')
  return { ok: true as const }
}

export function whatsAppMessageForStatus(input: {
  nome: string
  vaga: string
  status: CandidateStatus
  trainingDate?: string | null
}) {
  const first = input.nome.trim().split(' ')[0] || 'olá'
  const vaga = input.vaga || 'nossa vaga'

  if (input.status === 'aprovada') {
    const inicio = input.trainingDate ? ` Seu treinamento começa em ${formatDateBR(input.trainingDate)}.` : ''
    return `Olá ${first}! Parabéns 🎉 Você foi aprovado(a) na vaga ${vaga} da Panela Velha.${inicio} Qualquer dúvida, fale com a gente por aqui.`
  }
  if (input.status === 'entrevista') {
    return `Olá ${first}! Aqui é o RH da Panela Velha. Você avançou para Entrevista na vaga ${vaga}. Em breve combinamos o horário por aqui.`
  }
  if (input.status === 'banco') {
    return `Olá ${first}! Obrigado por participar do processo da vaga ${vaga}. Vamos manter seu perfil no banco de talentos e falamos quando surgir uma oportunidade.`
  }
  if (input.status === 'reprovada') {
    return `Olá ${first}! Agradecemos seu interesse na vaga ${vaga} da Panela Velha. Nesta etapa seguimos com outros perfis, mas guardamos seu cadastro para próximas oportunidades.`
  }
  return `Olá ${first}! Atualização sobre a vaga ${vaga} na Panela Velha: sua candidatura está em análise. Qualquer novidade falamos por aqui.`
}

export const DEFAULT_WHATSAPP_MSG =
  'Olá! Parabéns 🎉 Você passou para a próxima fase do processo seletivo da Panela Velha. Em breve combinamos os próximos passos por aqui.'
