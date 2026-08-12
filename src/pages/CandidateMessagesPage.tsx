import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { formatDateBR } from '@/lib/utils'
import { PublicHeader, LoadingScreen, EmptyState } from '@/components/Layout'

export function CandidateMessagesPage() {
  const { user, loading } = useAuth()
  const { getMessagesForProfile, store } = useData()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/auth?redirect=/mensagens" replace />

  const messages = getMessagesForProfile(user.id)

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-3xl text-[#F7F4EC]">Minhas mensagens</h1>
        <p className="mt-2 text-sm text-[var(--pv-cream)]/75">
          Notificações do RH sobre suas candidaturas.
        </p>

        <div className="mt-8 space-y-3">
          {messages.length === 0 ? (
            <EmptyState
              title="Nenhuma mensagem ainda"
              description="Quando o RH avançar sua candidatura, a notificação aparece aqui."
            />
          ) : (
            messages.map((m) => {
              const cand = store.candidatos.find((c) => c.id === m.candidato_id)
              return (
                <article key={m.id} className="pv-card animate-fade-up p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
                    {cand?.nome || 'Candidatura'} · {formatDateBR(m.created_at)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-[15px] text-[var(--pv-navy)]">{m.body}</p>
                </article>
              )
            })
          )}
        </div>

        <Link to="/" className="mt-8 inline-block text-sm font-semibold text-[var(--pv-cream)]">
          ← Voltar às vagas
        </Link>
      </div>
    </div>
  )
}
