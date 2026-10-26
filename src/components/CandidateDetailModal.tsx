import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { DEFAULT_WHATSAPP_MSG, openWhatsAppChat, whatsAppMessageForStatus } from '@/lib/whatsapp'
import { phoneFromCandidatoInfo } from '@/lib/candidatoInfo'
import { formatDateBR } from '@/lib/utils'
import { STATUS_META, type Candidato, type Experience, type Profile, type Vaga } from '@/types'
import { Button, Modal, NoticeModal, StatusPill } from '@/components/ui'
import { ProfileAnswers } from '@/components/ProfileAnswers'

export type CandidateDetailData = {
  candidato: Candidato
  profile?: Profile | null
  experiences?: Experience[]
  vaga?: Vaga | null
  unitName?: string
  score?: number
  reasons?: string[]
}

export function CandidateDetailModal({
  open,
  onClose,
  data,
  waMsg,
}: {
  open: boolean
  onClose: () => void
  data: CandidateDetailData | null
  waMsg?: string
}) {
  const { user } = useAuth()
  const { sendMessage } = useData()
  const [notice, setNotice] = useState<string | null>(null)

  if (!data) return null

  const { candidato, profile, experiences = [], vaga, unitName, score, reasons } = data
  const message =
    waMsg ||
    whatsAppMessageForStatus({
      nome: candidato.nome,
      vaga: vaga?.titulo || '',
      status: candidato.status,
      trainingDate: candidato.data_inicio_treinamento,
    }) ||
    DEFAULT_WHATSAPP_MSG
  const phone = phoneFromCandidatoInfo(candidato.info_complementar, profile?.phone)
  const hasPhone = Boolean(phone)

  return (
    <>
    <Modal open={open} title={candidato.nome} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          label={STATUS_META[candidato.status].label}
          color={STATUS_META[candidato.status].color}
          bg={STATUS_META[candidato.status].bg}
        />
        {typeof score === 'number' ? (
          <span className="rounded-md bg-[#F8E8E3] px-2.5 py-1 text-[11px] font-bold text-[var(--pv-terracotta)]">
            Match {score}%
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm font-semibold text-[var(--pv-ink)]">
        {vaga?.titulo || profile?.desired_role || 'Vaga'}
        {unitName ? ` · ${unitName}` : ''}
        {profile?.preferred_unit ? ` · quer ${profile.preferred_unit}` : ''}
      </p>

      <div className="mt-4">
        <ProfileAnswers profile={profile} candidato={candidato} />
      </div>

      {candidato.data_inicio_treinamento ? (
        <p className="mt-3 text-sm text-[#4A4636]">
          <strong>Início treinamento:</strong> {formatDateBR(candidato.data_inicio_treinamento)}
        </p>
      ) : null}
      <p className="mt-1 text-sm text-[#4A4636]">
        <strong>Candidatura:</strong> {formatDateBR(candidato.criado_em)}
      </p>

      {experiences.length > 0 ? (
        <section className="mt-4">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
            Experiências
          </h4>
          <div className="space-y-2">
            {experiences.map((exp) => (
              <div key={exp.id} className="rounded-xl border border-[var(--pv-line)] bg-white p-3 text-sm">
                <p className="font-semibold text-[var(--pv-ink)]">
                  {exp.role_title} · {exp.company}
                </p>
                <p className="text-xs text-[var(--pv-muted)]">
                  {exp.start_date || '—'} — {exp.end_date || 'atual'}
                </p>
                {exp.description ? <p className="mt-1 text-[#4A4636]">{exp.description}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {reasons && reasons.length > 0 ? (
        <ul className="mt-4 space-y-1 text-sm text-[var(--pv-muted)]">
          {reasons.map((reason) => (
            <li key={reason}>• {reason}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {hasPhone ? (
          <Button
            onClick={() => {
              const sent = openWhatsAppChat(phone, message)
              if (sent.error) {
                setNotice(sent.error)
                return
              }
              if (user) sendMessage(candidato.id, user.id, message)
            }}
          >
            <MessageCircle size={14} /> WhatsApp
          </Button>
        ) : (
          <Button variant="ghost" disabled title="Sem telefone cadastrado">
            <MessageCircle size={14} /> Sem WhatsApp
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Modal>
    <NoticeModal message={notice} onClose={() => setNotice(null)} />
    </>
  )
}
