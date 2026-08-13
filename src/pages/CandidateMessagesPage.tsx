import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { formatDateBR } from '@/lib/utils'
import { PublicHeader, PublicFooter, LoadingScreen, EmptyState } from '@/components/Layout'
import { Button, PageHeader } from '@/components/ui'

export function CandidateMessagesPage() {
  const { user, loading } = useAuth()
  const { getMessagesForProfile, store } = useData()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/auth?redirect=/mensagens" replace />

  const messages = getMessagesForProfile(user.id)

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <Link
          to="/candidato"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--pv-cream)]/80 hover:text-[var(--pv-cream)]"
        >
          <ArrowLeft size={16} /> Minha área
        </Link>

        <PageHeader
          eyebrow="Comunicação"
          title="Minhas mensagens"
          description="Cópia das mensagens que o RH envia pelo WhatsApp sobre suas candidaturas."
        />

        <div className="mt-8 space-y-3">
          {messages.length === 0 ? (
            <EmptyState
              tone="dark"
              icon={<MessageSquare size={20} />}
              title="Nenhuma mensagem ainda"
              description="Quando o RH avançar sua candidatura, a notificação aparece aqui."
              action={
                <Link to="/">
                  <Button variant="outline">Ver vagas</Button>
                </Link>
              }
            />
          ) : (
            messages.map((m) => {
              const cand = store.candidatos.find((c) => c.id === m.candidato_id)
              const vaga = store.vagas.find((v) => v.id === cand?.vaga_id)
              return (
                <article key={m.id} className="pv-card animate-fade-up p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
                      {vaga?.titulo || cand?.nome || 'Candidatura'}
                    </p>
                    <p className="text-[11px] font-semibold text-[var(--pv-muted)]">
                      {formatDateBR(m.created_at)}
                    </p>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--pv-navy)]">
                    {m.body}
                  </p>
                </article>
              )
            })
          )}
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
