import { useMemo, useState } from 'react'
import { Brain, MessageCircle, Sparkles, UserRound, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import {
  DEFAULT_WHATSAPP_MSG,
  buildWhatsAppUrl,
  scoreCandidateForVaga,
} from '@/lib/aiSelection'
import { DISC_LABELS } from '@/lib/disc'
import { Button, Field, Input, Select, StatusPill, Textarea } from '@/components/ui'
import { STATUS_META, type Candidato, type Profile } from '@/types'

type Ranked = {
  candidato: Candidato
  profile?: Profile | null
  score: number
  reasons: string[]
}

export function AdminSelectionPage() {
  const { isAdmin, profile: authProfile } = useAuth()
  const { store, updateCandidatoStatus } = useData()

  const units = useMemo(() => {
    if (isAdmin) return store.units
    const id = authProfile?.unit_id || store.units[0]?.id
    return store.units.filter((u) => u.id === id)
  }, [store.units, isAdmin, authProfile])

  const [unitId, setUnitId] = useState(units[0]?.id || '')
  const [vagaId, setVagaId] = useState('')
  const [pool, setPool] = useState<Ranked[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [askCount, setAskCount] = useState('10')
  const [analyzing, setAnalyzing] = useState(false)
  const [round, setRound] = useState(0)
  const [detail, setDetail] = useState<Ranked | null>(null)
  const [waMsg, setWaMsg] = useState(DEFAULT_WHATSAPP_MSG)

  const vagas = store.vagas.filter((v) => v.unit_id === unitId)
  const vaga = store.vagas.find((v) => v.id === vagaId)

  const allForVaga = useMemo(() => {
    if (!vaga) return [] as Ranked[]
    return store.candidatos
      .filter((c) => c.vaga_id === vaga.id && c.status !== 'reprovada')
      .map((c) => {
        const p = store.profiles.find((x) => x.id === c.profile_id) || null
        const exps = store.experiences.filter((e) => e.profile_id === c.profile_id).length
        const { score, reasons } = scoreCandidateForVaga(c, vaga, p, exps)
        return { candidato: c, profile: p, score, reasons }
      })
      .sort((a, b) => b.score - a.score)
  }, [store, vaga])

  function onPickUnit(id: string) {
    setUnitId(id)
    setVagaId('')
    setPool([])
    setSelectedIds([])
    setRound(0)
  }

  function onPickVaga(id: string) {
    setVagaId(id)
    setPool([])
    setSelectedIds([])
    setRound(0)
  }

  function runAiCut(count: number, fromList?: Ranked[]) {
    const source = fromList || allForVaga
    if (!source.length) return
    setAnalyzing(true)
    window.setTimeout(() => {
      const next = source.slice(0, Math.min(count, source.length))
      setPool(next)
      setSelectedIds(next.map((n) => n.candidato.id))
      setRound((r) => r + 1)
      setAnalyzing(false)
    }, 900)
  }

  function refineFromSelected(count: number) {
    const current = pool.filter((p) => selectedIds.includes(p.candidato.id))
    runAiCut(count, current.sort((a, b) => b.score - a.score))
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const winner = pool.length === 1 ? pool[0] : selectedIds.length === 1
    ? pool.find((p) => p.candidato.id === selectedIds[0])
    : null

  return (
    <div className="px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--pv-terracotta)]">
            Panela AI
          </p>
          <h1 className="font-display text-3xl text-[#F7F4EC]">Seleção inteligente</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--pv-cream)]/70">
            Escolha unidade e vaga. A IA lê o que a vaga pede, ranqueia os candidatos e você
            afina até chegar na pessoa certa — com WhatsApp pronto.
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[#1B2A57] to-[#121D40] p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[var(--pv-cream)]">
          <Brain size={18} className="text-[var(--pv-terracotta)]" />
          <span className="text-sm font-bold">Configurar seleção</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Unidade" labelClassName="text-[var(--pv-cream)]/80">
            <Select value={unitId} onChange={(e) => onPickUnit(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vaga" labelClassName="text-[var(--pv-cream)]/80">
            <Select value={vagaId} onChange={(e) => onPickVaga(e.target.value)}>
              <option value="">Escolha a vaga</option>
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quantas pessoas classificar?" labelClassName="text-[var(--pv-cream)]/80">
            <Input
              type="number"
              min={1}
              max={50}
              value={askCount}
              onChange={(e) => setAskCount(e.target.value)}
            />
          </Field>
        </div>

        {vaga ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[var(--pv-cream)]/85">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--pv-terracotta)]">
              O que a vaga pede
            </p>
            <p className="mt-1 font-semibold text-[#F7F4EC]">{vaga.titulo}</p>
            <p className="mt-2 leading-relaxed">{vaga.descricao}</p>
            <p className="mt-3 text-xs text-[var(--pv-cream)]/60">
              {allForVaga.length} candidatos elegíveis nesta vaga
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={!vagaId || analyzing || allForVaga.length === 0}
            onClick={() => runAiCut(Number(askCount) || 10)}
          >
            <Sparkles size={15} />
            {analyzing ? 'IA analisando perfis…' : `Classificar top ${askCount || 10}`}
          </Button>
          {pool.length > 1 && (
            <>
              <Button
                variant="cream"
                disabled={analyzing || selectedIds.length < 2}
                onClick={() => refineFromSelected(Math.min(5, selectedIds.length))}
              >
                Afiar para top 5
              </Button>
              <Button
                variant="outline"
                disabled={analyzing || selectedIds.length < 2}
                onClick={() => refineFromSelected(Math.max(1, Math.ceil(selectedIds.length / 2)))}
              >
                Reduzir pela metade
              </Button>
              <Button
                variant="outline"
                disabled={analyzing || selectedIds.length < 1}
                onClick={() => refineFromSelected(1)}
              >
                Escolher a #1
              </Button>
            </>
          )}
        </div>
        {round > 0 ? (
          <p className="mt-3 text-xs text-[var(--pv-cream)]/55">Rodada de seleção #{round}</p>
        ) : null}
      </section>

      {analyzing ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 py-16 text-[var(--pv-cream)]">
          <div className="pv-stamp-spin flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-[var(--pv-cream)]">
            <Brain size={22} />
          </div>
          <p className="font-display text-lg">Cruzando DISC, experiências e requisitos…</p>
        </div>
      ) : null}

      {!analyzing && pool.length > 0 ? (
        <section className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl text-[#F7F4EC]">
              Rankeados · {pool.length} pessoa{pool.length === 1 ? '' : 's'}
            </h2>
            {winner ? (
              <span className="rounded-full bg-[#E4F3E9] px-3 py-1 text-xs font-bold text-[#2F7D4F]">
                Finalista selecionado
              </span>
            ) : (
              <span className="text-xs text-[var(--pv-cream)]/60">
                Marque quem permanece e refine com a IA
              </span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pool.map((item, idx) => {
              const checked = selectedIds.includes(item.candidato.id)
              const phone = item.profile?.phone
              const wa = phone ? buildWhatsAppUrl(phone, waMsg) : null
              return (
                <article
                  key={item.candidato.id}
                  className={`rounded-2xl border bg-[#FBF9F3] p-4 shadow-lg transition ${
                    checked ? 'border-[var(--pv-terracotta)]' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <label className="mt-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(item.candidato.id)}
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-[var(--pv-navy)]">
                          #{idx + 1} {item.candidato.nome}
                        </p>
                        <span className="font-display text-lg text-[var(--pv-terracotta)]">
                          {item.score}%
                        </span>
                      </div>
                      <div className="mt-1">
                        <StatusPill
                          label={STATUS_META[item.candidato.status].label}
                          color={STATUS_META[item.candidato.status].color}
                          bg={STATUS_META[item.candidato.status].bg}
                        />
                      </div>
                      <ul className="mt-3 space-y-1 text-xs text-[#6B664F]">
                        {item.reasons.map((r) => (
                          <li key={r}>• {r}</li>
                        ))}
                      </ul>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setDetail(item)}>
                          <UserRound size={14} /> Ver perfil
                        </Button>
                        {wa ? (
                          <a href={wa} target="_blank" rel="noreferrer">
                            <Button size="sm">
                              <MessageCircle size={14} /> WhatsApp
                            </Button>
                          </a>
                        ) : (
                          <Button size="sm" variant="ghost" disabled title="Sem telefone">
                            <MessageCircle size={14} /> Sem telefone
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-6 rounded-2xl bg-[#FBF9F3] p-5 shadow-xl">
            <h3 className="font-display text-lg text-[var(--pv-navy)]">Mensagem padrão WhatsApp</h3>
            <p className="mt-1 text-sm text-[#6B664F]">
              Ao clicar no WhatsApp, abre conversa com o texto pronto.
            </p>
            <div className="mt-3">
              <Textarea rows={3} value={waMsg} onChange={(e) => setWaMsg(e.target.value)} />
            </div>
            {winner ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E4F3E9] bg-[#E4F3E9]/50 p-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#2F7D4F]">Escolhido: {winner.candidato.nome}</p>
                  <p className="text-xs text-[#6B664F]">Match {winner.score}% · pode avançar no pipeline</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    updateCandidatoStatus(winner.candidato.id, 'entrevista')
                    const phone = winner.profile?.phone
                    const url = phone ? buildWhatsAppUrl(phone, waMsg) : null
                    if (url) window.open(url, '_blank')
                  }}
                >
                  Avançar + WhatsApp
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {!analyzing && vagaId && pool.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-white/20 px-6 py-14 text-center text-[var(--pv-cream)]/70">
          <Sparkles className="mx-auto mb-3 text-[var(--pv-terracotta)]" />
          <p className="font-display text-lg text-[#F7F4EC]">Pronto para classificar</p>
          <p className="mt-2 text-sm">
            Defina quantas pessoas quer no primeiro corte e rode a IA.
          </p>
        </div>
      ) : null}

      {detail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(14,23,48,0.55)] p-5">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[#FBF9F3] p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
                  Match {detail.score}%
                </p>
                <h3 className="font-display text-xl text-[var(--pv-navy)]">{detail.candidato.nome}</h3>
              </div>
              <button type="button" className="rounded-lg p-2 hover:bg-[#F1EDE0]" onClick={() => setDetail(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[#4A4636]">
              <p>E-mail: {detail.profile?.email || '—'}</p>
              <p>Telefone: {detail.profile?.phone || '—'}</p>
              <p>Cidade: {detail.profile?.city || '—'}</p>
              <p>Disponibilidade: {detail.profile?.availability || '—'}</p>
              <p>Cargo desejado: {detail.profile?.desired_role || '—'}</p>
            </div>
            {detail.profile?.disc_d != null ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(['D', 'I', 'S', 'C'] as const).map((d) => {
                  const val =
                    d === 'D'
                      ? detail.profile?.disc_d
                      : d === 'I'
                        ? detail.profile?.disc_i
                        : d === 'S'
                          ? detail.profile?.disc_s
                          : detail.profile?.disc_c
                  return (
                    <div key={d} className="rounded-xl bg-[var(--pv-navy)] px-3 py-3 text-[var(--pv-cream)]">
                      <div className="text-[11px] opacity-80">{DISC_LABELS[d]}</div>
                      <div className="font-display text-xl">{Number(val || 0)}%</div>
                    </div>
                  )
                })}
              </div>
            ) : null}
            <ul className="mt-4 space-y-1 text-sm text-[#6B664F]">
              {detail.reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              {detail.profile?.phone && buildWhatsAppUrl(detail.profile.phone, waMsg) ? (
                <a
                  href={buildWhatsAppUrl(detail.profile.phone, waMsg)!}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button>
                    <MessageCircle size={14} /> WhatsApp
                  </Button>
                </a>
              ) : null}
              <Button variant="ghost" onClick={() => setDetail(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
