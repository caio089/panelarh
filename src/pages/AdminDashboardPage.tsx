import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Briefcase,
  ClipboardList,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
  Brain,
  Target,
  Gauge,
  Bot,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { countByStatus } from '@/lib/data'
import { scoreCandidateForVaga } from '@/lib/aiSelection'
import { STATUS_META, type CandidateStatus, type Candidato } from '@/types'
import { formatDateBR } from '@/lib/utils'
import { PageHeader, StatusPill } from '@/components/ui'
import { CandidateDetailModal, type CandidateDetailData } from '@/components/CandidateDetailModal'
import { VagaPipeline } from '@/components/VagaPipeline'

export function AdminDashboardPage() {
  const { isAdmin, isRh, profile } = useAuth()
  const { store } = useData()
  const [detail, setDetail] = useState<CandidateDetailData | null>(null)

  const unitIds = isAdmin || isRh
    ? store.units.map((u) => u.id)
    : [profile?.unit_id || store.units[0]?.id].filter(Boolean)

  const vagas = store.vagas.filter((v) => unitIds.includes(v.unit_id))
  const vagaIds = new Set(vagas.map((v) => v.id))
  const candidatos = store.candidatos.filter((c) => vagaIds.has(c.vaga_id))
  const counts = countByStatus(candidatos)
  const ativas = vagas.filter((v) => v.ativa).length

  const aiScores = candidatos.map((c) => {
    const vaga = store.vagas.find((v) => v.id === c.vaga_id)
    const profileRow = store.profiles.find((p) => p.id === c.profile_id)
    const exps = store.experiences.filter((e) => e.profile_id === c.profile_id).length
    if (!vaga) return 0
    return scoreCandidateForVaga(c, vaga, profileRow, exps).score
  })
  const avgMatch = aiScores.length
    ? Math.round(aiScores.reduce((a, b) => a + b, 0) / aiScores.length)
    : 0
  const highFit = aiScores.filter((s) => s >= 75).length
  const conversion =
    candidatos.length > 0 ? Math.round((counts.aprovada / candidatos.length) * 100) : 0
  const interviewRate =
    candidatos.length > 0
      ? Math.round(((counts.entrevista + counts.aprovada) / candidatos.length) * 100)
      : 0

  const topMatches = [...candidatos]
    .map((c) => {
      const vaga = store.vagas.find((v) => v.id === c.vaga_id)!
      const profileRow = store.profiles.find((p) => p.id === c.profile_id)
      const exps = store.experiences.filter((e) => e.profile_id === c.profile_id).length
      const scored = vaga ? scoreCandidateForVaga(c, vaga, profileRow, exps) : { score: 0, reasons: [] }
      return { c, vaga, scored }
    })
    .sort((a, b) => b.scored.score - a.scored.score)
    .slice(0, 5)

  const recent = [...candidatos]
    .sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em))
    .slice(0, 5)

  const byUnit = store.units
    .filter((u) => unitIds.includes(u.id))
    .map((u) => {
      const uv = store.vagas.filter((v) => v.unit_id === u.id)
      const uc = store.candidatos.filter((c) => uv.some((v) => v.id === c.vaga_id))
      return { unit: u, vagas: uv.length, candidatos: uc.length, aprovadas: countByStatus(uc).aprovada }
    })

  const maxUnitCands = Math.max(...byUnit.map((x) => x.candidatos), 1)
  const pipeline: CandidateStatus[] = ['pendente', 'entrevista', 'aprovada', 'banco', 'reprovada']
  const maxPipe = Math.max(...pipeline.map((s) => counts[s]), 1)

  function openCandidate(c: Candidato, score?: number, reasons?: string[]) {
    const vaga = store.vagas.find((v) => v.id === c.vaga_id) || null
    const unit = store.units.find((u) => u.id === vaga?.unit_id)
    setDetail({
      candidato: c,
      profile: store.profiles.find((p) => p.id === c.profile_id) || null,
      experiences: store.experiences.filter((e) => e.profile_id === c.profile_id),
      vaga,
      unitName: unit?.name,
      score,
      reasons,
    })
  }

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <div className="animate-fade-up">
        <PageHeader
          eyebrow="Módulo de RH"
          title="Painel de RH"
          description="Métricas operacionais e sinais de match para acelerar a seleção."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin/vagas"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-[var(--pv-cream)] transition hover:bg-white/10"
              >
                <Briefcase size={16} /> Vagas
              </Link>
              <Link
                to="/admin/selecao"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--pv-terracotta)] to-[#c94a32] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[var(--pv-terracotta)]/25 transition hover:brightness-105"
              >
                <Sparkles size={16} /> Abrir Seleção com IA
              </Link>
            </div>
          }
        />
      </div>

      <section className="mt-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-display text-2xl text-[#F7F4EC]">Pipeline das vagas</h2>
          <Link to="/admin/quadro" className="text-sm font-semibold text-[var(--pv-cream)]">
            Ver todas →
          </Link>
        </div>
        {vagas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/20 px-4 py-8 text-center text-sm text-[#EFE3C4]">
            Nenhuma vaga ainda. Abra uma vaga para acompanhar os candidatos aqui.
          </p>
        ) : (
          [...vagas]
            .sort((a, b) => Number(b.ativa !== false) - Number(a.ativa !== false))
            .map((vaga) => (
              <VagaPipeline
                key={vaga.id}
                vaga={vaga}
                unitName={store.units.find((unit) => unit.id === vaga.unit_id)?.name}
                candidatos={candidatos.filter((candidato) => candidato.vaga_id === vaga.id)}
              />
            ))
        )}
      </section>

      <section className="relative mt-7 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1B2A57] via-[#172448] to-[#121D40] p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--pv-terracotta)]/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-48 bg-[#EFE3C4]/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--pv-terracotta)]/20 text-[var(--pv-terracotta)]">
            <Brain size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg text-[#F7F4EC]">Motor de match Panela AI</h2>
              <span className="rounded-full border border-[var(--pv-cream)]/25 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--pv-cream)]">
                Preview
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-[#EFE3C4]">
              A nota desta tela é uma prévia local. O cruzamento de verdade fica na Seleção: o Groq lê a vaga e as respostas de cada pessoa.
            </p>
          </div>
        </div>
        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AiChip icon={<Gauge size={15} />} label="Match médio" value={`${avgMatch}%`} />
          <AiChip icon={<Target size={15} />} label="High-fit (≥75%)" value={String(highFit)} />
          <AiChip icon={<Zap size={15} />} label="Taxa entrevista+" value={`${interviewRate}%`} />
          <AiChip icon={<Bot size={15} />} label="Prontos p/ seleção" value={String(candidatos.filter((c) => c.status !== 'reprovada' && c.status !== 'banco').length)} />
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<Briefcase size={18} />} label="Vagas ativas" value={String(ativas)} hint={`${vagas.length} no total`} />
        <Kpi icon={<Users size={18} />} label="Candidatos" value={String(candidatos.length)} hint={`${counts.entrevista} em entrevista`} />
        <Kpi icon={<ClipboardList size={18} />} label="Em análise" value={String(counts.pendente)} hint="Aguardando triagem" />
        <Kpi icon={<CheckCircle2 size={18} />} label="Conversão" value={`${conversion}%`} hint={`${counts.aprovada} aprovados`} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl bg-[#FBF9F3] p-5 shadow-xl sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl text-[var(--pv-ink)]">Pipeline</h2>
            <Link to="/admin/quadro" className="text-sm font-semibold text-[var(--pv-terracotta)]">
              Ver quadro →
            </Link>
          </div>
          <div className="space-y-4">
            {pipeline.map((status) => (
              <div key={status}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-semibold text-[var(--pv-ink)]">{STATUS_META[status].label}</span>
                  <span className="font-bold text-[var(--pv-muted)]">{counts[status]}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#E7E2D3]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(counts[status] / maxPipe) * 100}%`,
                      background: STATUS_META[status].color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-[#FBF9F3] p-5 shadow-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-[var(--pv-ink)]">Top match IA</h2>
            <Sparkles size={16} className="text-[var(--pv-terracotta)]" />
          </div>
          <div className="space-y-3">
            {topMatches.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--pv-line)] px-4 py-8 text-center text-sm text-[var(--pv-muted)]">
                Ainda não há candidatos para ranquear.
              </p>
            ) : (
              topMatches.map(({ c, vaga, scored }, idx) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openCandidate(c, scored.score, scored.reasons)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--pv-line)] bg-white p-3 text-left transition hover:border-[var(--pv-terracotta)]/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--pv-terracotta)] text-xs font-bold text-white">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[var(--pv-ink)]">{c.nome}</p>
                    <p className="text-xs font-medium leading-snug text-[var(--pv-muted)]">
                      {vaga?.titulo}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg text-[var(--pv-terracotta)]">{scored.score}%</p>
                    <p className="text-[10px] font-bold uppercase text-[#A9A493]">fit</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-[#FBF9F3] p-5 shadow-xl sm:p-6">
          <h2 className="font-display text-xl text-[var(--pv-ink)]">Por unidade</h2>
          <div className="mt-5 space-y-4">
            {byUnit.map((row) => (
              <div key={row.unit.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold text-[var(--pv-ink)]">{row.unit.name}</span>
                  <span className="text-[var(--pv-muted)]">
                    {row.candidatos} cand. · {row.vagas} vagas
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#E7E2D3]">
                  <div
                    className="h-full rounded-full bg-[var(--pv-terracotta)]"
                    style={{ width: `${(row.candidatos / maxUnitCands) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-[#FBF9F3] p-5 shadow-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-[var(--pv-ink)]">Recentes</h2>
            <Link to="/admin/candidatos" className="text-sm font-semibold text-[var(--pv-terracotta)]">
              Ver todos →
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map((c) => {
              const vaga = store.vagas.find((v) => v.id === c.vaga_id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openCandidate(c)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E7E2D3] bg-white px-3 py-2.5 text-left transition hover:border-[var(--pv-terracotta)]/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--pv-ink)]">{c.nome}</p>
                    <p className="text-xs font-medium leading-snug text-[var(--pv-muted)]">
                      {vaga?.titulo} · {formatDateBR(c.criado_em)}
                    </p>
                  </div>
                  <StatusPill
                    label={STATUS_META[c.status].label}
                    color={STATUS_META[c.status].color}
                    bg={STATUS_META[c.status].bg}
                  />
                </button>
              )
            })}
          </div>
          <Link
            to="/admin/selecao"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--pv-terracotta)]"
          >
            Ir para seleção inteligente <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>

      <CandidateDetailModal open={Boolean(detail)} data={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

function AiChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-[#0E1730]/55 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#EFE3C4]">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-display text-2xl text-white">{value}</p>
    </div>
  )
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="animate-fade-up rounded-2xl bg-[#FBF9F3] p-5 shadow-xl">
      <span className="inline-flex rounded-xl bg-[#F8E8E3] p-2 text-[var(--pv-terracotta)]">{icon}</span>
      <p className="mt-4 text-[12px] font-bold uppercase tracking-[1px] text-[var(--pv-muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl text-[var(--pv-ink)]">{value}</p>
      <p className="mt-1 text-xs font-medium text-[var(--pv-muted)]">{hint}</p>
    </div>
  )
}
