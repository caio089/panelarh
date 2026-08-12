import { Link, Navigate } from 'react-router-dom'
import { Briefcase, CheckCircle2, FileUser, MessageSquare } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { PublicHeader, LoadingScreen, EmptyState } from '@/components/Layout'
import { Button, StatusPill } from '@/components/ui'
import { STATUS_META } from '@/types'
import { formatDateBR } from '@/lib/utils'

export function CandidateAreaPage() {
  const { user, profile, loading, isStaff } = useAuth()
  const { store } = useData()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/auth?redirect=/candidato" replace />
  if (isStaff) return <Navigate to="/admin" replace />

  const candidaturas = store.candidatos
    .filter((c) => c.profile_id === user.id)
    .sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em))

  const messages = store.messages.filter((m) =>
    candidaturas.some((c) => c.id === m.candidato_id),
  )

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <div className="mx-auto max-w-5xl px-5 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--pv-terracotta)]">
          Área do candidato
        </p>
        <h1 className="mt-1 font-display text-3xl text-[#F7F4EC] sm:text-4xl">
          Olá, {profile?.full_name?.split(' ')[0] || 'candidato'}
        </h1>
        <p className="mt-2 text-sm text-[var(--pv-cream)]/70">
          Aqui você acompanha seu perfil, candidaturas e mensagens do RH.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Link to="/perfil" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
            <FileUser className="text-[var(--pv-terracotta)]" size={20} />
            <p className="mt-3 font-display text-lg text-[#F7F4EC]">Meu perfil</p>
            <p className="mt-1 text-xs text-[var(--pv-cream)]/65">
              {profile?.onboarding_completed ? 'Perfil completo' : 'Complete para se candidatar'}
            </p>
          </Link>
          <a href="/#vagas" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
            <Briefcase className="text-[var(--pv-terracotta)]" size={20} />
            <p className="mt-3 font-display text-lg text-[#F7F4EC]">Ver vagas</p>
            <p className="mt-1 text-xs text-[var(--pv-cream)]/65">Voltar à página pública</p>
          </a>
          <Link to="/mensagens" className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
            <MessageSquare className="text-[var(--pv-terracotta)]" size={20} />
            <p className="mt-3 font-display text-lg text-[#F7F4EC]">Mensagens</p>
            <p className="mt-1 text-xs text-[var(--pv-cream)]/65">{messages.length} notificação(ões)</p>
          </Link>
        </div>

        {!profile?.onboarding_completed ? (
          <div className="mt-8 rounded-2xl border border-[var(--pv-terracotta)]/40 bg-[var(--pv-terracotta)]/10 p-5">
            <p className="font-semibold text-[#F7F4EC]">Complete seu cadastro</p>
            <p className="mt-1 text-sm text-[var(--pv-cream)]/75">
              Dados pessoais, experiências e DISC são enviados ao RH quando você se candidata.
            </p>
            <Link to="/perfil" className="mt-4 inline-block">
              <Button>Preencher perfil</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-8 flex items-center gap-2 rounded-2xl bg-[#E4F3E9]/15 px-4 py-3 text-sm text-[#E4F3E9]">
            <CheckCircle2 size={16} /> Perfil pronto para candidaturas
          </div>
        )}

        <section className="mt-10">
          <h2 className="font-display text-2xl text-[#F7F4EC]">Minhas candidaturas</h2>
          <div className="mt-4 space-y-3">
            {candidaturas.length === 0 ? (
              <EmptyState
                title="Nenhuma candidatura ainda"
                description="Escolha uma vaga na página pública e clique em Candidatar-se."
              />
            ) : (
              candidaturas.map((c) => {
                const vaga = store.vagas.find((v) => v.id === c.vaga_id)
                const unit = store.units.find((u) => u.id === vaga?.unit_id)
                return (
                  <article key={c.id} className="pv-card flex flex-wrap items-center justify-between gap-3 p-5">
                    <div>
                      <p className="font-bold text-[var(--pv-navy)]">{vaga?.titulo || 'Vaga'}</p>
                      <p className="text-sm text-[#6B664F]">
                        {unit?.name} · enviada em {formatDateBR(c.criado_em)}
                      </p>
                    </div>
                    <StatusPill
                      label={STATUS_META[c.status].label}
                      color={STATUS_META[c.status].color}
                      bg={STATUS_META[c.status].bg}
                    />
                  </article>
                )
              })
            )}
          </div>
          {candidaturas.length === 0 ? (
            <Link to="/" className="mt-4 inline-block">
              <Button>Ir para vagas</Button>
            </Link>
          ) : null}
        </section>
      </div>
    </div>
  )
}
