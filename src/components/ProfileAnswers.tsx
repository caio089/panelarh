import type { Profile } from '@/types'

export function ProfileAnswers({ profile }: { profile?: Profile | null }) {
  if (!profile) {
    return <p className="text-sm italic text-[#A9A493]">Sem dados de perfil</p>
  }

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
      {profile.about_me ? (
        <Block title="Sobre a pessoa" text={profile.about_me} />
      ) : null}
      {profile.relevant_experience ? (
        <Block title="Experiência relevante" text={profile.relevant_experience} />
      ) : null}
      {profile.why_company ? (
        <Block title="Por que a Panela Velha" text={profile.why_company} />
      ) : null}
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
