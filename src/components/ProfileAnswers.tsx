import type { Candidato, Profile } from '@/types'
import { rowsFromCandidatoInfo } from '@/lib/candidatoInfo'

export function ProfileAnswers({
  profile,
  candidato,
}: {
  profile?: Profile | null
  candidato?: Pick<Candidato, 'nome' | 'info_complementar' | 'experiencia'> | null
}) {
  if (profile) {
    const rows: Array<[string, string]> = [
      ['E-mail', profile.email || '—'],
      ['WhatsApp', profile.phone || '—'],
      ['CPF', profile.cpf || '—'],
      ['Bairro', profile.city || '—'],
      ['Cargo de interesse', profile.desired_role || '—'],
      ['Unidade desejada', profile.preferred_unit || '—'],
      ['Turnos', profile.shifts || profile.availability || '—'],
      ['Finais de semana', profile.weekend_availability || '—'],
      ['Possui transporte', profile.has_transport || '—'],
    ]

    return (
      <div className="space-y-3 text-sm text-[#4A4636]">
        <div className="space-y-1.5 rounded-xl border border-[var(--pv-line)] bg-white p-3">
          {rows.map(([label, value]) => (
            <p key={label}>
              <strong>{label}:</strong> {value}
            </p>
          ))}
        </div>
        {profile.about_me ? <Block title="Sobre a pessoa" text={profile.about_me} /> : null}
        {profile.relevant_experience ? (
          <Block title="Experiência relevante" text={profile.relevant_experience} />
        ) : null}
        {profile.why_company ? <Block title="Por que a Panela Velha" text={profile.why_company} /> : null}
      </div>
    )
  }

  if (!candidato) {
    return <p className="text-sm italic text-[#A9A493]">Sem dados de perfil</p>
  }

  const rows = rowsFromCandidatoInfo(candidato.info_complementar).filter(
    ([label]) => !['Sobre', 'Motivação'].includes(label),
  )
  const about = rowsFromCandidatoInfo(candidato.info_complementar).find(([l]) => l === 'Sobre')?.[1]
  const why = rowsFromCandidatoInfo(candidato.info_complementar).find(([l]) => l === 'Motivação')?.[1]

  return (
    <div className="space-y-3 text-sm text-[#4A4636]">
      <div className="space-y-1.5 rounded-xl border border-[var(--pv-line)] bg-white p-3">
        <p>
          <strong>Nome:</strong> {candidato.nome}
        </p>
        {rows.map(([label, value]) => (
          <p key={`${label}-${value}`}>
            <strong>{label}:</strong> {value}
          </p>
        ))}
      </div>
      {about ? <Block title="Sobre a pessoa" text={about} /> : null}
      {candidato.experiencia ? <Block title="Experiência relevante" text={candidato.experiencia} /> : null}
      {why ? <Block title="Por que a Panela Velha" text={why} /> : null}
    </div>
  )
}

function Block({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-[var(--pv-line)] bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">{title}</p>
      <p className="mt-1 whitespace-pre-wrap">{text}</p>
    </div>
  )
}
