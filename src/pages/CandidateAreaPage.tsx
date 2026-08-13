import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Briefcase, CheckCircle2, FileUser, MessageSquare, ArrowRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { PublicHeader, PublicFooter, LoadingScreen, EmptyState } from '@/components/Layout'
import { Alert, Button, PageHeader, StatusPill } from '@/components/ui'
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
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        <PageHeader
          eyebrow="Área do candidato"
          title={`Olá, ${profile?.full_name?.split(' ')[0] || 'candidato'}`}
          description="Acompanhe seu perfil, candidaturas e mensagens do RH em um só lugar."
        />

        <div className="pv-stagger mt-8 grid gap-3 sm:grid-cols-3">
          <QuickLink
            to="/perfil"
            icon={<FileUser size={18} />}
            title="Meu perfil"
            desc={profile?.onboarding_completed ? 'Perfil completo · editar' : 'Complete para se candidatar'}
          />
          <QuickLink
            to="/"
            icon={<Briefcase size={18} />}
            title="Ver vagas"
            desc="Voltar à página pública"
          />
          <QuickLink
            to="/mensagens"
            icon={<MessageSquare size={18} />}
            title="Mensagens"
            desc={
              messages.length === 0
                ? 'Nenhuma notificação'
                : `${messages.length} notificação${messages.length === 1 ? '' : 'ões'}`
            }
          />
        </div>

        {!profile?.onboarding_completed ? (
          <div className="mt-8 rounded-2xl border border-[var(--pv-terracotta)]/35 bg-[var(--pv-terracotta)]/12 p-5">
            <p className="font-semibold text-[#F7F4EC]">Complete seu cadastro</p>
            <p className="mt-1 text-sm text-[var(--pv-cream)]/75">
              Dados pessoais, experiências e DISC são enviados ao RH quando você se candidata.
            </p>
            <Link to="/perfil" className="mt-4 inline-block">
              <Button>
                Preencher perfil <ArrowRight size={15} />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <Alert tone="success" className="border border-white/10 bg-[#E4F3E9]/15 text-[#E4F3E9]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} /> Perfil pronto para candidaturas
              </span>
            </Alert>
          </div>
        )}

        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-2xl text-[#F7F4EC]">Minhas candidaturas</h2>
            {candidaturas.length > 0 ? (
              <Link to="/" className="text-sm font-semibold text-[var(--pv-cream)]/80 hover:text-[var(--pv-cream)]">
                Ver mais vagas →
              </Link>
            ) : null}
          </div>

          {candidaturas.length === 0 ? (
            <EmptyState
              tone="dark"
              title="Nenhuma candidatura ainda"
              description="Escolha uma vaga na página pública e clique em Candidatar-se."
              action={
                <Link to="/">
                  <Button>Ir para vagas</Button>
                </Link>
              }
            />
          ) : (
            <div className="pv-stagger space-y-3">
              {candidaturas.map((c) => {
                const vaga = store.vagas.find((v) => v.id === c.vaga_id)
                const unit = store.units.find((u) => u.id === vaga?.unit_id)
                return (
                  <article
                    key={c.id}
                    className="pv-card flex flex-wrap items-center justify-between gap-3 p-5"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[var(--pv-navy)]">{vaga?.titulo || 'Vaga'}</p>
                      <p className="mt-0.5 text-sm text-[var(--pv-muted)]">
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
              })}
            </div>
          )}
        </section>
      </div>
      <PublicFooter />
    </div>
  )
}

function QuickLink({
  to,
  icon,
  title,
  desc,
}: {
  to: string
  icon: ReactNode
  title: string
  desc: string
}) {
  return (
    <Link
      to={to}
      className="pv-panel group p-5 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-terracotta)]"
    >
      <div className="text-[var(--pv-terracotta)]">{icon}</div>
      <p className="mt-3 font-display text-lg text-[#F7F4EC]">{title}</p>
      <p className="mt-1 text-xs text-[var(--pv-cream)]/65">{desc}</p>
      <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--pv-cream)]/80 opacity-0 transition group-hover:opacity-100">
        Abrir <ArrowRight size={12} />
      </p>
    </Link>
  )
}
