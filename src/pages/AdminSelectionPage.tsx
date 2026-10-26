import { useEffect, useMemo, useState } from 'react'
import { Brain, MessageCircle, Sparkles, UserRound } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { requestGrokSelection } from '@/lib/grokSelection'
import { DEFAULT_WHATSAPP_MSG, openWhatsAppChat, whatsAppMessageForStatus } from '@/lib/whatsapp'
import { phoneFromCandidatoInfo } from '@/lib/candidatoInfo'
import { Button, Field, Input, NoticeModal, PageHeader, Select, StatusPill, Textarea } from '@/components/ui'
import { CandidateDetailModal, type CandidateDetailData } from '@/components/CandidateDetailModal'
import { STATUS_META, type Candidato, type Profile, type Vaga } from '@/types'

type Ranked = {
  candidato: Candidato
  profile?: Profile | null
  vaga: Vaga
  score: number
  reasons: string[]
}

export function AdminSelectionPage() {
  const { isAdmin, isRh, profile: authProfile, user } = useAuth()
  const { store, finishVagaSelection, sendMessage } = useData()

  const units = useMemo(() => {
    if (isAdmin || isRh) return store.units
    const id = authProfile?.unit_id || store.units[0]?.id
    return store.units.filter((u) => u.id === id)
  }, [store.units, isAdmin, isRh, authProfile])

  const [unitId, setUnitId] = useState(units[0]?.id || '')
  const [vagaId, setVagaId] = useState('')
  const [cut, setCut] = useState<Ranked[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [askCount, setAskCount] = useState('3')
  const [analyzing, setAnalyzing] = useState(false)
  const [round, setRound] = useState(0)
  const [detail, setDetail] = useState<CandidateDetailData | null>(null)
  const [waMsg, setWaMsg] = useState(DEFAULT_WHATSAPP_MSG)
  const [aiWhy, setAiWhy] = useState<{ headline: string; summary: string; picks: string[] } | null>(
    null,
  )
  const [aiError, setAiError] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingChoice, setPendingChoice] = useState<Ranked | null>(null)

  useEffect(() => {
    if (!unitId && units[0]?.id) setUnitId(units[0].id)
  }, [units, unitId])

  const vagas = store.vagas.filter((v) => v.unit_id === unitId && v.ativa !== false)
  const vaga = store.vagas.find((v) => v.id === vagaId)

  const allForVaga = useMemo(() => {
    if (!vaga) return [] as Ranked[]
    return store.candidatos
      .filter((c) => c.vaga_id === vaga.id && c.status !== 'reprovada' && c.status !== 'banco')
      .map((c) => {
        const p = store.profiles.find((x) => x.id === c.profile_id) || null
        return { candidato: c, profile: p, vaga, score: 0, reasons: [] }
      })
      .sort((a, b) => b.score - a.score)
  }, [store, vaga])

  // Lista classificada: corte da IA ou ranking completo da vaga
  const displayed = cut ?? allForVaga

  function onPickUnit(id: string) {
    setUnitId(id)
    setVagaId('')
    setCut(null)
    setSelectedIds([])
    setRound(0)
    setAiWhy(null)
    setAiError('')
    setPendingChoice(null)
  }

  function onPickVaga(id: string) {
    setVagaId(id)
    setCut(null)
    setSelectedIds([])
    setRound(0)
    setAiWhy(null)
    setAiError('')
    setPendingChoice(null)
  }

  const requestedCount = Math.max(1, Math.min(50, Number(askCount) || 3))

  async function runAiCut(count: number, fromList?: Ranked[]) {
    const source = fromList || allForVaga
    if (!source.length || !vaga) return
    const take = Math.min(Math.max(1, count), source.length)
    setAnalyzing(true)
    setAiError('')
    try {
      const result = await requestGrokSelection({
        count: take,
        vaga,
        candidatos: source.map((item) => item.candidato),
      })
      const byId = new Map(result.ranking.map((item) => [item.id, item]))
      const ranked = source
        .map((item) => {
          const grok = byId.get(item.candidato.id)
          return grok ? { ...item, score: grok.score, reasons: grok.reasons } : item
        })
        .sort((a, b) => b.score - a.score)
      const next = ranked.slice(0, take)
      setCut(next)
      setSelectedIds(next.map((item) => item.candidato.id))
      setRound((current) => current + 1)
      setAiWhy({
        headline: next.length === 1 ? 'Por que o Groq escolheu esta pessoa' : `Por que o Groq escolheu estas ${next.length} pessoas`,
        summary: result.summary,
        picks: next.map(
          (item, index) =>
            `${index + 1}. ${item.candidato.nome} (${item.score}%) — ${item.reasons.join('; ')}.`,
        ),
      })
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'O Groq não conseguiu cruzar as candidaturas.')
    } finally {
      setAnalyzing(false)
    }
  }

  function refineFromSelected(count: number) {
    const current = displayed.filter((p) => selectedIds.includes(p.candidato.id))
    runAiCut(count, current.sort((a, b) => b.score - a.score))
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function notifyWhatsApp(candidatoId: string, phone: string | null | undefined, body: string) {
    const sent = openWhatsAppChat(phone, body)
    if (sent.error) {
      setNotice(sent.error)
      return
    }
    if (user) sendMessage(candidatoId, user.id, body)
  }

  function chooseAndClose(item: Ranked) {
    if (item.vaga.ativa === false) return
    setPendingChoice(item)
  }

  function confirmChoice() {
    if (!pendingChoice || pendingChoice.vaga.ativa === false) return
    const result = finishVagaSelection(pendingChoice.vaga.id, pendingChoice.candidato.id)
    setPendingChoice(null)
    if ('error' in result) {
      setNotice(result.error)
      return
    }
    setCut(null)
    setSelectedIds([])
    setAiWhy(null)
  }

  function openDetail(item: Ranked) {
    const unit = store.units.find((u) => u.id === item.vaga.unit_id)
    setDetail({
      candidato: item.candidato,
      profile: item.profile,
      experiences: store.experiences.filter((e) => e.profile_id === item.candidato.profile_id),
      vaga: item.vaga,
      unitName: unit?.name,
      score: item.score,
      reasons: item.reasons,
    })
  }

  const winner =
    displayed.length === 1
      ? displayed[0]
      : selectedIds.length === 1
        ? displayed.find((p) => p.candidato.id === selectedIds[0])
        : null

  return (
    <div className="px-5 py-6 sm:px-8">
      <PageHeader
        eyebrow="Panela AI"
        title="Seleção inteligente"
        description="O Groq cruza o que a vaga pede com a experiência e as respostas de cada pessoa. Ao confirmar a escolha, a vaga fecha e os demais vão para o banco de talentos."
      />

      <section className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[#1B2A57] to-[#121D40] p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[var(--pv-cream)]">
          <Brain size={18} className="text-[var(--pv-terracotta)]" />
          <span className="text-sm font-bold">Configurar seleção</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Unidade" labelClassName="text-[#EFE3C4]">
            <Select value={unitId} onChange={(e) => onPickUnit(e.target.value)}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Vaga" labelClassName="text-[#EFE3C4]">
            <Select value={vagaId} onChange={(e) => onPickVaga(e.target.value)}>
              <option value="">Escolha a vaga</option>
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo}
                </option>
              ))}
              {vaga && vaga.ativa === false ? (
                <option value={vaga.id}>{vaga.titulo} · encerrada</option>
              ) : null}
            </Select>
          </Field>
          <Field label="Quantas pessoas selecionar?" labelClassName="text-[#EFE3C4]">
            <Input
              type="number"
              min={1}
              max={50}
              value={askCount}
              onChange={(e) => setAskCount(e.target.value)}
              placeholder="3"
            />
          </Field>
        </div>

        {vaga ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[#EFE3C4]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--pv-terracotta)]">
              O que a vaga pede
            </p>
            <p className="mt-1 font-semibold text-white">{vaga.titulo}</p>
            <p className="mt-2 leading-relaxed">{vaga.descricao}</p>
            <p className="mt-3 text-xs text-[#EFE3C4]/80">
              {allForVaga.length} candidato{allForVaga.length === 1 ? '' : 's'} classificado
              {allForVaga.length === 1 ? '' : 's'} nesta vaga
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={!vagaId || analyzing || allForVaga.length === 0 || vaga?.ativa === false}
            onClick={() => runAiCut(requestedCount)}
          >
            <Sparkles size={15} />
            {analyzing
              ? 'Groq cruzando com a vaga…'
              : `Pedir ao Groq ${requestedCount}`}
          </Button>
          {displayed.length > 1 && cut ? (
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
          ) : null}
        </div>
        {aiError ? <p className="mt-3 text-sm text-[#F3C1B6]">{aiError}</p> : null}
        {round > 0 ? (
          <p className="mt-3 text-xs text-[#EFE3C4]/70">Rodada de seleção #{round}</p>
        ) : null}
      </section>

      {!vagaId ? (
        <section className="mt-6">
          <h2 className="font-display text-xl text-[#F7F4EC]">Vagas desta unidade</h2>
          <p className="mt-1 text-sm text-[#EFE3C4]">
            Clique na vaga para ver os candidatos já classificados — sem despejar tudo de uma vez.
          </p>
          {vagas.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-white/20 px-6 py-12 text-center text-[#EFE3C4]">
              Nenhuma vaga nesta unidade.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {vagas.map((v) => {
                const count = store.candidatos.filter(
                  (c) => c.vaga_id === v.id && c.status !== 'reprovada' && c.status !== 'banco',
                ).length
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onPickVaga(v.id)}
                    className="rounded-2xl bg-[#FBF9F3] p-4 text-left shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
                      {count} candidato{count === 1 ? '' : 's'}
                    </p>
                    <h3 className="mt-1 font-display text-lg leading-snug text-[var(--pv-ink)]">
                      {v.titulo}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--pv-muted)]">
                      {v.descricao || v.localidade || 'Sem descrição'}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      ) : null}

      {analyzing ? (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 py-16 text-[var(--pv-cream)]">
          <div className="pv-stamp-spin flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-[var(--pv-cream)]">
            <Brain size={22} />
          </div>
          <p className="font-display text-lg">O Groq está cruzando cada candidatura com a vaga…</p>
        </div>
      ) : null}

      {pendingChoice && pendingChoice.vaga.ativa !== false ? (
        <section className="mt-6 rounded-2xl border border-[var(--pv-terracotta)] bg-[#FBF9F3] p-5 shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
            Confirmar escolha
          </p>
          <h2 className="mt-2 font-display text-2xl text-[var(--pv-ink)]">{pendingChoice.candidato.nome}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4A4636]">
            Esta pessoa fica escolhida na vaga <strong>{pendingChoice.vaga.titulo}</strong>. A seleção acaba, a vaga
            fecha e sai do site.
            {store.candidatos.filter(
              (candidato) =>
                candidato.vaga_id === pendingChoice.vaga.id &&
                candidato.id !== pendingChoice.candidato.id &&
                (candidato.status === 'pendente' || candidato.status === 'entrevista'),
            ).length > 0
              ? ' Quem não foi escolhido vai para o banco de talentos.'
              : ''}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={confirmChoice}>Confirmar e fechar vaga</Button>
            <Button variant="ghost" onClick={() => setPendingChoice(null)}>
              Cancelar
            </Button>
          </div>
        </section>
      ) : null}

      {!analyzing && vaga && vaga.ativa === false ? (
        <section className="mt-6 rounded-2xl border border-[#E4F3E9] bg-[#FBF9F3] p-6 shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-[1px] text-[#2F7D4F]">Seleção encerrada</p>
          <h2 className="mt-2 font-display text-2xl text-[var(--pv-ink)]">
            {store.candidatos.find((candidato) => candidato.vaga_id === vaga.id && candidato.status === 'aprovada')
              ?.nome || 'A pessoa escolhida'}{' '}
            foi escolhida
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4A4636]">
            A vaga <strong>{vaga.titulo}</strong> fechou e saiu do site. Quem não foi escolhido está no banco de
            talentos.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[#4A4636]">
            {store.candidatos
              .filter((candidato) => candidato.vaga_id === vaga.id && candidato.status === 'aprovada')
              .map((candidato) => (
                <li key={candidato.id} className="rounded-xl bg-[#E4F3E9] px-3 py-2 font-semibold text-[#2F7D4F]">
                  Escolhida: {candidato.nome}
                </li>
              ))}
            {store.candidatos
              .filter((candidato) => candidato.vaga_id === vaga.id && candidato.status === 'banco')
              .map((candidato) => (
                <li key={candidato.id} className="rounded-xl bg-[#FBF1DC] px-3 py-2">
                  Banco de talentos: {candidato.nome}
                </li>
              ))}
          </ul>
          {store.candidatos.some(
            (candidato) => candidato.vaga_id === vaga.id && candidato.status === 'aprovada',
          ) ? (
            <Button
              className="mt-4"
              onClick={() => {
                const chosen = store.candidatos.find(
                  (candidato) => candidato.vaga_id === vaga.id && candidato.status === 'aprovada',
                )
                if (!chosen) return
                notifyWhatsApp(
                  chosen.id,
                  phoneFromCandidatoInfo(chosen.info_complementar),
                  whatsAppMessageForStatus({
                    nome: chosen.nome,
                    vaga: vaga.titulo,
                    status: 'aprovada',
                  }),
                )
              }}
            >
              <MessageCircle size={14} /> Avisar a pessoa escolhida
            </Button>
          ) : null}
        </section>
      ) : null}

      {!analyzing && vaga?.ativa !== false && vagaId && displayed.length > 0 ? (
        <section className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl text-[#F7F4EC]">
              {cut
                ? `Selecionados pelo Groq · ${displayed.length} pessoa${displayed.length === 1 ? '' : 's'}`
                : `Candidaturas · ${displayed.length} pessoa${displayed.length === 1 ? '' : 's'}`}
            </h2>
            {winner ? (
              <span className="rounded-full bg-[#E4F3E9] px-3 py-1 text-xs font-bold text-[#2F7D4F]">
                Finalista selecionado
              </span>
            ) : (
              <span className="text-xs text-[#EFE3C4]">
                Clique no card para ver o perfil · marque quem permanece para afinar
              </span>
            )}
          </div>

          {aiWhy ? (
            <article className="mb-5 rounded-2xl border border-[rgba(225,91,63,0.35)] bg-[#FBF9F3] p-5 shadow-xl">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
                <Sparkles size={14} /> {aiWhy.headline}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--pv-ink)]">{aiWhy.summary}</p>
              <ul className="mt-3 space-y-2 text-sm text-[#4A4636]">
                {aiWhy.picks.map((line) => (
                  <li key={line} className="rounded-xl bg-[#F1EDE0] px-3 py-2 leading-relaxed">
                    {line}
                  </li>
                ))}
              </ul>
            </article>
          ) : vagaId && !cut ? (
            <p className="mb-4 text-sm text-[#EFE3C4]">
              Informe quantas pessoas você quer e peça ao Groq. Ele explica o cruzamento com a vaga.
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayed.map((item, idx) => {
              const checked = selectedIds.includes(item.candidato.id)
              const phone = phoneFromCandidatoInfo(item.candidato.info_complementar, item.profile?.phone)
              return (
                <article
                  key={item.candidato.id}
                  className={`rounded-2xl border bg-[#FBF9F3] p-4 shadow-lg transition ${
                    checked ? 'border-[var(--pv-terracotta)]' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <label className="mt-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(item.candidato.id)}
                      />
                    </label>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => openDetail(item)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-[var(--pv-ink)]">
                          #{idx + 1} {item.candidato.nome}
                        </p>
                        <span className="font-display text-lg text-[var(--pv-terracotta)]">
                          {cut ? `${item.score}%` : 'Sem nota'}
                        </span>
                      </div>
                      <div className="mt-1">
                        <StatusPill
                          label={STATUS_META[item.candidato.status].label}
                          color={STATUS_META[item.candidato.status].color}
                          bg={STATUS_META[item.candidato.status].bg}
                        />
                      </div>
                      <ul className="mt-3 space-y-1 text-xs text-[var(--pv-muted)]">
                        {(cut ? item.reasons : ['O Groq ainda não cruzou esta candidatura com a vaga.']).map((r) => (
                          <li key={r}>• {r}</li>
                        ))}
                      </ul>
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => chooseAndClose(item)}>
                      Escolher e fechar vaga
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openDetail(item)}>
                      <UserRound size={14} /> Ver perfil
                    </Button>
                    {phone ? (
                      <Button
                        size="sm"
                        onClick={() => notifyWhatsApp(item.candidato.id, phone, waMsg)}
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled title="Sem telefone">
                        <MessageCircle size={14} /> Sem telefone
                      </Button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-6 rounded-2xl bg-[#FBF9F3] p-5 shadow-xl">
            <h3 className="font-display text-lg text-[var(--pv-ink)]">Mensagem padrão WhatsApp</h3>
            <p className="mt-1 text-sm text-[var(--pv-muted)]">
              Ao clicar no WhatsApp, abre conversa com o texto pronto.
            </p>
            <div className="mt-3">
              <Textarea rows={3} value={waMsg} onChange={(e) => setWaMsg(e.target.value)} />
            </div>
            {winner && winner.vaga.ativa !== false ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E4F3E9] bg-[#E4F3E9]/50 p-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#2F7D4F]">Escolhido: {winner.candidato.nome}</p>
                  <p className="text-xs text-[var(--pv-muted)]">
                    Confirmar encerra a seleção, fecha a vaga e manda os demais para o banco de talentos.
                  </p>
                </div>
                <Button size="sm" onClick={() => chooseAndClose(winner)}>
                  Escolher e fechar vaga
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--pv-muted)]">
                Marque uma pessoa para escolher. A vaga só fecha depois dessa confirmação.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {!analyzing && vaga?.ativa !== false && vagaId && displayed.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-white/20 px-6 py-14 text-center text-[#EFE3C4]">
          <Sparkles className="mx-auto mb-3 text-[var(--pv-terracotta)]" />
          <p className="font-display text-lg text-white">Nenhum candidato nesta vaga</p>
          <p className="mt-2 text-sm">Quando houver candidaturas, elas aparecem classificadas aqui.</p>
        </div>
      ) : null}

      <NoticeModal message={notice} onClose={() => setNotice(null)} />
      <CandidateDetailModal
        open={Boolean(detail)}
        data={detail}
        onClose={() => setDetail(null)}
        waMsg={waMsg}
      />
    </div>
  )
}
