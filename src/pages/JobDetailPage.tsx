import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Building2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { PublicHeader } from '@/components/Layout'
import { Button } from '@/components/ui'
import type { Experience, Profile } from '@/types'
import { uid } from '@/lib/utils'

function loadMockExperiences(profileId: string): Experience[] {
  try {
    const raw = localStorage.getItem(`panela_rh_mock_form_${profileId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as {
      experiences?: Array<{
        id: string
        company: string
        role_title: string
        start_date?: string | null
        end_date?: string | null
        description?: string | null
      }>
    }
    return (parsed.experiences || [])
      .filter((e) => e.company?.trim() && e.role_title?.trim())
      .map((e) => ({
        id: e.id || uid(),
        profile_id: profileId,
        company: e.company,
        role_title: e.role_title,
        start_date: e.start_date || null,
        end_date: e.end_date || null,
        description: e.description || null,
      }))
  } catch {
    return []
  }
}

export function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, isStaff } = useAuth()
  const { getVaga, applyToVaga, store } = useData()
  const [applying, setApplying] = useState(false)
  const [message, setMessage] = useState('')

  const vaga = id ? getVaga(id) : undefined

  async function handleApply() {
    if (isStaff) {
      setMessage('Contas de RH não se candidatam. Use a Área do candidato.')
      return
    }
    if (!user) {
      navigate(`/auth?redirect=/vagas/${id}`)
      return
    }
    if (!profile?.onboarding_completed) {
      navigate(`/perfil?redirect=/vagas/${id}`)
      return
    }
    if (!vaga) return

    setApplying(true)

    const fromStore = store.experiences.filter((e) => e.profile_id === user.id)
    const fromLocal = loadMockExperiences(user.id)
    const experiences = fromStore.length ? fromStore : fromLocal

    const expText = experiences
      .map(
        (e) =>
          `${e.role_title} @ ${e.company}${e.start_date ? ` (${e.start_date}${e.end_date ? `–${e.end_date}` : ''})` : ''}${
            e.description ? `: ${e.description}` : ''
          }`,
      )
      .join('\n')

    const fullProfile: Profile = {
      ...profile,
      id: user.id,
      email: profile.email || user.email || null,
      role: 'candidate',
      onboarding_completed: true,
    }

    const result = await applyToVaga({
      vagaId: vaga.id,
      profile: fullProfile,
      experiences,
      nome: fullProfile.full_name || user.email || 'Candidato',
      experiencia: expText || null,
      info: [
        fullProfile.phone && `Tel: ${fullProfile.phone}`,
        fullProfile.cpf && `CPF: ${fullProfile.cpf}`,
        fullProfile.city && `Cidade: ${fullProfile.city}`,
        fullProfile.birth_date && `Nascimento: ${fullProfile.birth_date}`,
        fullProfile.desired_role && `Cargo desejado: ${fullProfile.desired_role}`,
        fullProfile.availability && `Disponibilidade: ${fullProfile.availability}`,
        fullProfile.salary_expectation && `Pretensão: ${fullProfile.salary_expectation}`,
        fullProfile.linkedin && `LinkedIn: ${fullProfile.linkedin}`,
        `DISC D${fullProfile.disc_d ?? 0} I${fullProfile.disc_i ?? 0} S${fullProfile.disc_s ?? 0} C${fullProfile.disc_c ?? 0}`,
      ]
        .filter(Boolean)
        .join(' · '),
    })

    setApplying(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setMessage('Candidatura enviada! Seu perfil completo já aparece no painel do RH.')
    window.setTimeout(() => navigate('/candidato'), 900)
  }

  if (!vaga) {
    return (
      <div className="min-h-screen">
        <PublicHeader />
        <div className="mx-auto max-w-3xl px-5 py-16 text-[var(--pv-cream)]">Vaga não encontrada.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[var(--pv-cream)]/80">
          <ArrowLeft size={16} /> Voltar às vagas
        </Link>

        <article className="pv-card animate-fade-up mt-6 p-7 sm:p-9">
          <p className="text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--pv-terracotta)]">
            Oportunidade
          </p>
          <h1 className="mt-2 font-display text-3xl text-[var(--pv-navy)] sm:text-4xl">{vaga.titulo}</h1>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#6B664F]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1EDE0] px-3 py-1">
              <Building2 size={14} />
              {vaga.unitName}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1EDE0] px-3 py-1">
              <MapPin size={14} />
              {vaga.localidade || vaga.tipo || 'Presencial'}
            </span>
          </div>

          <div className="mt-7 whitespace-pre-wrap text-[15px] leading-relaxed text-[#3F3B2F]">
            {vaga.descricao}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[#E7E2D3] pt-6">
            <Button size="lg" onClick={() => void handleApply()} disabled={applying}>
              {applying ? 'Enviando…' : 'Candidatar-se agora'}
            </Button>
            {!user && (
              <p className="text-sm text-[#6B664F]">Crie sua conta de candidato para enviar a candidatura.</p>
            )}
          </div>
          {message ? (
            <p className="mt-4 rounded-xl bg-[#E4F3E9] px-4 py-3 text-sm font-semibold text-[#2F7D4F]">
              {message}
            </p>
          ) : null}
        </article>
      </div>
    </div>
  )
}
