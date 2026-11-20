import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ClipboardList, Plus, Users } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { countByStatus } from '@/lib/data'
import { STATUS_META, type Candidato } from '@/types'
import { formatDateBR } from '@/lib/utils'
import { PageHeader, StatusPill } from '@/components/ui'
import { CandidateDetailModal, type CandidateDetailData } from '@/components/CandidateDetailModal'

export function AdminDashboardPage() {
  const { store } = useData()
  const [detail, setDetail] = useState<CandidateDetailData | null>(null)

  const vagas = store.vagas
  const vagasAtivas = vagas.filter((vaga) => vaga.ativa)
  const vagaIds = new Set(vagas.map((vaga) => vaga.id))
  const candidaturas = store.candidatos.filter((candidato) => vagaIds.has(candidato.vaga_id))
  const counts = countByStatus(candidaturas)
  const recentes = [...candidaturas]
    .sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em))
    .slice(0, 6)

  function openCandidate(candidato: Candidato) {
    const vaga = vagas.find((item) => item.id === candidato.vaga_id) || null
    const unit = store.units.find((item) => item.id === vaga?.unit_id)
    setDetail({
      candidato,
      profile: store.profiles.find((item) => item.id === candidato.profile_id) || null,
      experiences: store.experiences.filter((item) => item.profile_id === candidato.profile_id),
      vaga,
      unitName: unit?.name,
    })
  }

  const nextAction =
    vagas.length === 0
      ? {
          title: 'Crie a primeira vaga',
          description: 'Assim que a vaga estiver publicada, as pessoas poderão se candidatar pelo site.',
          to: '/admin/vagas',
          label: 'Criar vaga',
          icon: Plus,
        }
      : counts.pendente > 0
        ? {
            title: `${counts.pendente} candidatura${counts.pendente === 1 ? '' : 's'} para analisar`,
            description: 'Abra as candidaturas novas, confira o currículo e defina o próximo passo de cada pessoa.',
            to: '/admin/candidatos?status=pendente',
            label: 'Analisar agora',
            icon: ClipboardList,
          }
        : counts.entrevista > 0
          ? {
              title: `${counts.entrevista} pessoa${counts.entrevista === 1 ? '' : 's'} em entrevista`,
              description: 'Atualize o resultado para que ninguém fique sem retorno.',
              to: '/admin/candidatos?status=entrevista',
              label: 'Ver entrevistas',
              icon: Users,
            }
          : {
              title: 'Nada pendente agora',
              description: 'Você pode acompanhar as vagas abertas ou criar uma nova vaga quando precisar.',
              to: '/admin/vagas',
              label: 'Ver vagas',
              icon: CheckCircle2,
            }
  const NextIcon = nextAction.icon

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
      <PageHeader
        eyebrow="RH"
        title="O que você precisa fazer?"
        description="Comece pela próxima ação. As outras funções ficam no menu ao lado."
      />

      <section className="mt-6 border-l-4 border-[var(--pv-terracotta)] bg-[#FBF9F3] px-5 py-5 shadow-lg sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F8E8E3] text-[var(--pv-terracotta)]">
            <NextIcon size={19} />
          </span>
          <div>
            <p className="font-display text-xl text-[var(--pv-ink)]">{nextAction.title}</p>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--pv-muted)]">{nextAction.description}</p>
          </div>
        </div>
        <Link
          to={nextAction.to}
          className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--pv-terracotta)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(225,91,63,0.28)] transition hover:bg-[var(--pv-terracotta-deep)] sm:mt-0"
        >
          {nextAction.label} <ArrowRight size={16} />
        </Link>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-[#F7F4EC]">Candidaturas novas</h2>
            <p className="mt-1 text-sm text-[var(--pv-cream)]/75">As últimas pessoas que se candidataram às suas vagas.</p>
          </div>
          <Link to="/admin/candidatos" className="text-sm font-bold text-[#F7F4EC] underline underline-offset-4 hover:text-white">
            Ver todas as candidaturas
          </Link>
        </div>

        {recentes.length === 0 ? (
          <div className="mt-4 border border-dashed border-white/25 px-5 py-8 text-center text-sm text-[var(--pv-cream)]/80">
            Ainda não há candidaturas. Confira se há vagas publicadas no site.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl bg-[#FBF9F3] shadow-xl">
            {recentes.map((candidato, index) => {
              const vaga = vagas.find((item) => item.id === candidato.vaga_id)
              return (
                <button
                  key={candidato.id}
                  type="button"
                  onClick={() => openCandidate(candidato)}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-[#F7F4EC] focus-visible:outline-2 focus-visible:outline-[var(--pv-terracotta)] ${index > 0 ? 'border-t border-[var(--pv-line)]' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[var(--pv-ink)]">{candidato.nome}</p>
                    <p className="mt-0.5 truncate text-sm text-[var(--pv-muted)]">
                      {vaga?.titulo || 'Vaga não encontrada'} · {formatDateBR(candidato.criado_em)}
                    </p>
                  </div>
                  <StatusPill
                    label={STATUS_META[candidato.status].label}
                    color={STATUS_META[candidato.status].color}
                    bg={STATUS_META[candidato.status].bg}
                  />
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl bg-[#FBF9F3] p-5 shadow-xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-[var(--pv-ink)]">Vagas abertas</h2>
            <p className="mt-1 text-sm text-[var(--pv-muted)]">Veja quantas pessoas estão em cada processo.</p>
          </div>
          <Link to="/admin/vagas" className="inline-flex items-center gap-1 text-sm font-bold text-[var(--pv-terracotta)]">
            Gerenciar vagas <ArrowRight size={15} />
          </Link>
        </div>
        {vagasAtivas.length === 0 ? (
          <div className="mt-5 border border-dashed border-[var(--pv-line-strong)] px-4 py-6 text-sm text-[var(--pv-muted)]">
            Nenhuma vaga ativa no momento. <Link to="/admin/vagas" className="font-bold text-[var(--pv-terracotta)] underline">Criar uma vaga</Link>
          </div>
        ) : (
          <div className="mt-5 divide-y divide-[var(--pv-line)] border-y border-[var(--pv-line)]">
            {vagasAtivas.map((vaga) => {
              const total = candidaturas.filter((candidato) => candidato.vaga_id === vaga.id).length
              const unit = store.units.find((item) => item.id === vaga.unit_id)
              return (
                <Link
                  key={vaga.id}
                  to={`/admin/vagas/${vaga.id}`}
                  className="flex items-center justify-between gap-4 px-1 py-4 transition hover:bg-[#F7F4EC]"
                >
                  <div>
                    <p className="font-bold text-[var(--pv-ink)]">{vaga.titulo}</p>
                    <p className="mt-0.5 text-sm text-[var(--pv-muted)]">{unit?.name || 'Unidade não informada'}</p>
                  </div>
                  <span className="shrink-0 text-right text-sm font-bold text-[var(--pv-navy)]">
                    {total} candidatura{total === 1 ? '' : 's'}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <CandidateDetailModal open={Boolean(detail)} data={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
