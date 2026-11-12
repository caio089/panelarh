import type { ReactNode } from 'react'
import type { Candidato, Profile } from '@/types'
import { formatCpf, formatPhone } from '@/lib/applicationForm'
import { rowsFromCandidatoInfo } from '@/lib/candidatoInfo'

const FICHA_LABELS: Record<string, string> = {
  WhatsApp: 'WhatsApp',
  CPF: 'CPF',
  Bairro: 'Bairro',
  Idade: 'Idade',
  Unidade: 'Unidade de preferência',
  'Unidade de preferência': 'Unidade de preferência',
  Turnos: 'Turnos',
  'Fim de semana': 'Pode trabalhar no fim de semana',
  'Como chega': 'Como chega no trabalho',
  Feriados: 'Pode trabalhar em feriados',
  Restaurante: 'Já trabalhou em restaurante',
  Funções: 'O que já fez',
  'Último trabalho': 'Último trabalho',
  'No dia a dia': 'O que fazia no dia a dia',
  'Por que a vaga': 'Por que quer esta vaga',
  Motivação: 'Por que quer esta vaga',
  Começa: 'Quando pode começar',
  'Carteira de trabalho': 'Tem carteira de trabalho',
  'Como soube': 'Como ficou sabendo da vaga',
  'Fica em pé': 'Consegue ficar o turno em pé',
  'Restrição de horário': 'Restrição de horário',
  Sobre: 'Sobre a pessoa',
  Referência: 'Referência',
}

const LONG_LABELS = new Set([
  'Último trabalho',
  'O que fazia no dia a dia',
  'Por que quer esta vaga',
  'Restrição de horário',
  'Sobre a pessoa',
])

function displayLabel(raw: string) {
  return FICHA_LABELS[raw] || raw
}

function displayValue(label: string, value: string) {
  if (label === 'CPF') return formatCpf(value)
  if (label === 'WhatsApp') return formatPhone(value)
  return value
}

export function ProfileAnswers({
  profile,
  candidato,
}: {
  profile?: Profile | null
  candidato?: Pick<Candidato, 'nome' | 'info_complementar' | 'experiencia' | 'curriculo_url' | 'curriculo_nome' | 'referencia'> | null
}) {
  if (candidato?.info_complementar || candidato?.experiencia || candidato?.curriculo_url) {
    return <ApplicationFicha candidato={candidato} />
  }

  if (profile) return <LegacyProfile profile={profile} />

  return <p className="text-sm italic text-[#A9A493]">Sem dados de perfil</p>
}

function ApplicationFicha({
  candidato,
}: {
  candidato: Pick<Candidato, 'nome' | 'info_complementar' | 'experiencia' | 'curriculo_url' | 'curriculo_nome' | 'referencia'>
}) {
  const infoRows = rowsFromCandidatoInfo(candidato.info_complementar)
  const seen = new Set(infoRows.map(([label]) => displayLabel(label)))
  const facts: Array<[string, string]> = [['Nome', candidato.nome]]
  const stories: Array<[string, string]> = []

  for (const [raw, value] of infoRows) {
    const label = displayLabel(raw)
    const shown = displayValue(raw, value)
    if (LONG_LABELS.has(label)) stories.push([label, shown])
    else facts.push([label, shown])
  }

  if (candidato.experiencia && !seen.has('Último trabalho') && !seen.has('O que fazia no dia a dia')) {
    stories.push(['Experiência', candidato.experiencia])
  }

  if (candidato.referencia && !seen.has('Referência')) {
    facts.push(['Referência', candidato.referencia])
  }

  const resumeUrl = candidato.curriculo_url
  const resumeName = candidato.curriculo_nome || 'Abrir currículo'

  return (
    <div className="space-y-3 text-sm text-[#4A4636]">
      <Section title="Ficha completa">
        {facts.map(([label, value]) => (
          <p key={`${label}-${value}`}>
            <strong>{label}:</strong> {value}
          </p>
        ))}
      </Section>
      {stories.map(([title, text]) => (
        <Block key={title} title={title} text={text} />
      ))}
      {resumeUrl ? (
        <a
          href={resumeUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-xl border border-[var(--pv-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--pv-terracotta)] hover:bg-[#F8E8E3]"
        >
          Currículo: {resumeName}
        </a>
      ) : (
        <p className="text-xs text-[#A9A493]">Currículo não anexado.</p>
      )}
    </div>
  )
}

function LegacyProfile({ profile }: { profile: Profile }) {
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
      <Section title="Ficha completa">
        {rows.map(([label, value]) => (
          <p key={label}>
            <strong>{label}:</strong> {value}
          </p>
        ))}
      </Section>
      {profile.about_me ? <Block title="Sobre a pessoa" text={profile.about_me} /> : null}
      {profile.relevant_experience ? <Block title="Experiência relevante" text={profile.relevant_experience} /> : null}
      {profile.why_company ? <Block title="Por que a Panela Velha" text={profile.why_company} /> : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-[var(--pv-line)] bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">{title}</p>
      {children}
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
