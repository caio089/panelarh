import { useMemo, useState, type MouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { countByStatus } from '@/lib/data'
import { generateVagaDraft } from '@/lib/aiVaga'
import { Alert, Button, Field, Input, Modal, PageHeader, Select, StatusPill, Textarea } from '@/components/ui'
import { CandidateDetailModal, type CandidateDetailData } from '@/components/CandidateDetailModal'
import { EmptyState } from '@/components/Layout'
import { STATUS_META, type CandidateStatus, type Vaga } from '@/types'
import { formatDateBR } from '@/lib/utils'

type VagaForm = {
  unitId: string
  titulo: string
  descricao: string
  localidade: string
  tipo: string
  ativa: boolean
  salario: string
  horario: string
  regime: string
  responsabilidades: string
  requisitos: string
  diferenciais: string
  beneficios: string
}

const emptyForm = (unitId = ''): VagaForm => ({
  unitId,
  titulo: '',
  descricao: '',
  localidade: '',
  tipo: 'Presencial',
  ativa: true,
  salario: '',
  horario: '',
  regime: 'CLT',
  responsabilidades: '',
  requisitos: '',
  diferenciais: '',
  beneficios: '',
})

export function AdminVagasListPage() {
  const { isAdmin, isRh, profile } = useAuth()
  const { store, vagasError, addVaga, updateVaga, deleteVaga } = useData()

  const unitIds = isAdmin || isRh
    ? store.units.map((u) => u.id)
    : [profile?.unit_id || store.units[0]?.id]

  const vagas = store.vagas.filter((v) => unitIds.includes(v.unit_id))
  const units = store.units.filter((u) => unitIds.includes(u.id))

  const [detail, setDetail] = useState<Vaga | null>(null)
  const [editing, setEditing] = useState<Vaga | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<VagaForm>(emptyForm())
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setFormError('')
    setCreating(true)
    setEditing(null)
    setForm(emptyForm(units[0]?.id || ''))
  }

  function openEdit(vaga: Vaga, e?: MouseEvent) {
    e?.stopPropagation()
    setEditing(vaga)
    setCreating(false)
    setDetail(null)
    setForm({
      unitId: vaga.unit_id,
      titulo: vaga.titulo,
      descricao: vaga.descricao || '',
      localidade: vaga.localidade || '',
      tipo: vaga.tipo || 'Presencial',
      ativa: vaga.ativa ?? true,
      salario: vaga.salario || '',
      horario: vaga.horario || '',
      regime: vaga.regime || 'CLT',
      responsabilidades: vaga.responsabilidades || '',
      requisitos: vaga.requisitos || '',
      diferenciais: vaga.diferenciais || '',
      beneficios: vaga.beneficios || '',
    })
  }

  async function saveForm() {
    if (!form.titulo.trim() || !form.unitId) return
    const details = {
      salario: form.salario.trim(),
      horario: form.horario.trim(),
      regime: form.regime.trim() || 'CLT',
      responsabilidades: form.responsabilidades.trim(),
      requisitos: form.requisitos.trim(),
      diferenciais: form.diferenciais.trim(),
      beneficios: form.beneficios.trim(),
    }
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        await updateVaga(editing.id, {
          unit_id: form.unitId,
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim(),
          localidade: form.localidade.trim(),
          tipo: form.tipo,
          ativa: form.ativa,
          ...details,
        })
      } else {
        await addVaga({
          unitId: form.unitId,
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim(),
          localidade: form.localidade.trim(),
          tipo: form.tipo,
          ativa: form.ativa,
          ...details,
        })
      }
      setCreating(false)
      setEditing(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível salvar a vaga.')
    } finally {
      setSaving(false)
    }
  }

  async function removeVaga(vaga: Vaga, e?: MouseEvent) {
    e?.stopPropagation()
    if (!confirm(`Excluir a vaga "${vaga.titulo}" e seus candidatos?`)) return
    try {
      await deleteVaga(vaga.id)
      if (detail?.id === vaga.id) setDetail(null)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível excluir a vaga.')
    }
  }

  return (
    <div className="px-5 py-6 sm:px-8">
      <PageHeader
        eyebrow="Cadastro"
        title="Vagas"
        description={`${vagas.length} vaga${vagas.length === 1 ? '' : 's'} cadastrada${vagas.length === 1 ? '' : 's'}`}
        actions={
          units.length === 0 ? (
            isAdmin ? (
              <Link to="/admin/unidades">
                <Button>
                  <Plus size={16} /> Cadastrar unidade
                </Button>
              </Link>
            ) : undefined
          ) : (
            <Button onClick={openCreate}>
              <Plus size={16} /> Nova vaga
            </Button>
          )
        }
      />
      {vagasError ? (
        <Alert tone="error" className="mt-4">
          {vagasError}
        </Alert>
      ) : null}

      {vagas.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            tone="dark"
            title={units.length === 0 ? 'Cadastre uma unidade primeiro' : 'Nenhuma vaga ainda'}
            description={
              units.length === 0
                ? 'As vagas ficam ligadas a uma unidade. Crie a casa e depois publique a vaga.'
                : 'Crie a primeira vaga para começar a receber candidaturas.'
            }
            action={
              units.length === 0 && isAdmin ? (
                <Link to="/admin/unidades">
                  <Button>
                    <Plus size={16} /> Criar unidade
                  </Button>
                </Link>
              ) : units.length > 0 ? (
                <Button onClick={openCreate}>
                  <Plus size={16} /> Criar vaga
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="pv-stagger mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vagas.map((vaga) => {
            const unit = store.units.find((u) => u.id === vaga.unit_id)
            const cands = store.candidatos.filter((c) => c.vaga_id === vaga.id)
            const counts = countByStatus(cands)
            return (
              <button
                key={vaga.id}
                type="button"
                onClick={() => setDetail(vaga)}
                className="rounded-2xl bg-[var(--pv-surface)] p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-terracotta)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
                    {unit?.name}
                  </p>
                  <div className="flex gap-1">
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Editar vaga"
                      className="rounded-lg bg-[#F1EDE0] p-1.5 text-[var(--pv-navy)] hover:bg-[#E7E2D3]"
                      onClick={(e) => openEdit(vaga, e)}
                      onKeyDown={(e) => e.key === 'Enter' && openEdit(vaga)}
                    >
                      <Pencil size={14} />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Excluir vaga"
                      className="rounded-lg bg-[#FBEAEA] p-1.5 text-[#B23B3B] hover:bg-[#f5d5d5]"
                      onClick={(e) => removeVaga(vaga, e)}
                      onKeyDown={(e) => e.key === 'Enter' && removeVaga(vaga)}
                    >
                      <Trash2 size={14} />
                    </span>
                  </div>
                </div>
                <h2 className="mt-1 font-display text-xl leading-snug text-[var(--pv-ink)]">{vaga.titulo}</h2>
                <p className="mt-2 line-clamp-2 text-sm text-[var(--pv-muted)]">{vaga.descricao}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <StatusPill label={`${cands.length} candidatos`} color="#1B2A57" bg="#EEF0F4" />
                  {counts.entrevista ? (
                    <StatusPill
                      label={`${counts.entrevista} entrevista`}
                      color={STATUS_META.entrevista.color}
                      bg={STATUS_META.entrevista.bg}
                    />
                  ) : null}
                  {!vaga.ativa ? <StatusPill label="Inativa" color="#6B664F" bg="#F1EDE0" /> : null}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Modal
        open={Boolean(detail)}
        title={detail?.titulo || 'Detalhe da vaga'}
        onClose={() => setDetail(null)}
        wide
      >
        {detail ? (
          <>
            <p className="pv-eyebrow">
              {store.units.find((u) => u.id === detail.unit_id)?.name}
            </p>
            <div className="mt-4 space-y-2 text-sm text-[#4A4636]">
              <p>
                <strong>Local:</strong> {detail.localidade || '—'}
              </p>
              <p>
                <strong>Tipo / regime:</strong> {detail.tipo || '—'} · {detail.regime || 'CLT'}
              </p>
              <p>
                <strong>Salário:</strong> {detail.salario || '—'}
              </p>
              <p>
                <strong>Horário:</strong> {detail.horario || '—'}
              </p>
              <p>
                <strong>Status:</strong> {detail.ativa ? 'Ativa' : 'Inativa'}
              </p>
              <p>
                <strong>Criada em:</strong> {formatDateBR(detail.criada_em)}
              </p>
              <p className="whitespace-pre-wrap rounded-xl border border-[var(--pv-line)] bg-white p-3">
                {detail.descricao}
              </p>
              {detail.requisitos ? (
                <p className="whitespace-pre-wrap rounded-xl border border-[var(--pv-line)] bg-white p-3">
                  <strong>Requisitos</strong>
                  {'\n'}
                  {detail.requisitos}
                </p>
              ) : null}
              <p>
                <strong>Candidatos:</strong>{' '}
                {store.candidatos.filter((c) => c.vaga_id === detail.id).length}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => openEdit(detail)}>
                <Pencil size={14} /> Editar
              </Button>
              <Link to={`/admin/vagas/${detail.id}`}>
                <Button>Abrir pipeline</Button>
              </Link>
              <Button variant="danger" onClick={() => removeVaga(detail)}>
                <Trash2 size={14} /> Excluir
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <VagaFormModal
        open={creating || Boolean(editing)}
        title={editing ? 'Editar vaga' : 'Nova vaga'}
        form={form}
        units={units}
        error={formError}
        saving={saving}
        onChange={setForm}
        onClose={() => {
          setCreating(false)
          setEditing(null)
          setFormError('')
        }}
        onSave={() => void saveForm()}
      />
    </div>
  )
}

function VagaFormModal({
  open,
  title,
  form,
  units,
  error,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean
  title: string
  form: VagaForm
  units: { id: string; name: string }[]
  error?: string
  saving?: boolean
  onChange: (f: VagaForm) => void
  onClose: () => void
  onSave: () => void
}) {
  const [aiLoading, setAiLoading] = useState(false)

  function fillWithAi() {
    if (!form.titulo.trim() || aiLoading) return
    setAiLoading(true)
    window.setTimeout(() => {
      const unitName = units.find((u) => u.id === form.unitId)?.name
      const draft = generateVagaDraft({
        titulo: form.titulo,
        unitName,
        tipo: form.tipo,
        regime: form.regime,
      })
      onChange({
        ...form,
        descricao: draft.descricao,
        localidade: form.localidade.trim() || draft.localidade,
        horario: draft.horario,
        salario: form.salario.trim() || draft.salario,
        responsabilidades: draft.responsabilidades,
        requisitos: draft.requisitos,
        diferenciais: draft.diferenciais,
        beneficios: draft.beneficios,
      })
      setAiLoading(false)
    }, 700)
  }

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Unidade">
          <Select value={form.unitId} onChange={(e) => onChange({ ...form, unitId: e.target.value })}>
            {units.length === 0 ? (
              <option value="">Nenhuma unidade cadastrada</option>
            ) : (
              units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))
            )}
          </Select>
        </Field>
        <Field
          label="Título *"
          hint="Digite o cargo e use a IA para montar descrição, requisitos e benefícios."
        >
          <Input
            value={form.titulo}
            onChange={(e) => onChange({ ...form, titulo: e.target.value })}
            placeholder="Ex: Chapeiro, Garçom, Gerente de loja"
          />
        </Field>
        <Button
          type="button"
          variant="navy"
          className="w-full"
          disabled={!form.titulo.trim() || aiLoading}
          onClick={fillWithAi}
        >
          <Sparkles size={15} />
          {aiLoading ? 'IA preenchendo os campos…' : 'Preencher com IA'}
        </Button>
        <Field label="Localidade">
          <Input value={form.localidade} onChange={(e) => onChange({ ...form, localidade: e.target.value })} />
        </Field>
        <Field label="Tipo">
          <Select value={form.tipo} onChange={(e) => onChange({ ...form, tipo: e.target.value })}>
            <option>Presencial</option>
            <option>Híbrido</option>
            <option>Remoto</option>
          </Select>
        </Field>
          <Field label="Descrição curta">
            <Textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => onChange({ ...form, descricao: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Salário">
              <Input
                value={form.salario}
                onChange={(e) => onChange({ ...form, salario: e.target.value })}
                placeholder="Ex: R$ 2.400 – R$ 2.900"
              />
            </Field>
            <Field label="Regime">
              <Select value={form.regime} onChange={(e) => onChange({ ...form, regime: e.target.value })}>
                <option>CLT</option>
                <option>Temporário</option>
                <option>Estágio</option>
                <option>PJ</option>
              </Select>
            </Field>
          </div>
          <Field label="Horário / escala">
            <Input
              value={form.horario}
              onChange={(e) => onChange({ ...form, horario: e.target.value })}
              placeholder="Ex: Seg a sáb · turnos de 8h"
            />
          </Field>
          <Field label="Responsabilidades" hint="Uma por linha (use • no início se quiser)">
            <Textarea
              rows={4}
              value={form.responsabilidades}
              onChange={(e) => onChange({ ...form, responsabilidades: e.target.value })}
            />
          </Field>
          <Field label="O que a vaga pede (requisitos)">
            <Textarea
              rows={4}
              value={form.requisitos}
              onChange={(e) => onChange({ ...form, requisitos: e.target.value })}
            />
          </Field>
          <Field label="Diferenciais">
            <Textarea
              rows={3}
              value={form.diferenciais}
              onChange={(e) => onChange({ ...form, diferenciais: e.target.value })}
            />
          </Field>
          <Field label="Benefícios">
            <Textarea
              rows={3}
              value={form.beneficios}
              onChange={(e) => onChange({ ...form, beneficios: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--pv-navy)]">
            <input
              type="checkbox"
              checked={form.ativa}
              onChange={(e) => onChange({ ...form, ativa: e.target.checked })}
            />
            Vaga ativa (visível no site)
          </label>
          {error ? <Alert tone="error">{error}</Alert> : null}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={onSave} disabled={!form.titulo.trim() || !form.unitId || saving || aiLoading}>
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </Modal>
  )
}

const STATUS_FILTERS: CandidateStatus[] = ['pendente', 'entrevista', 'aprovada', 'banco']

function statusFromQuery(value: string | null): 'all' | CandidateStatus {
  if (value === 'reprovada' || value === 'banco') return 'banco'
  if (value === 'pendente' || value === 'entrevista' || value === 'aprovada') return value
  return 'all'
}

export function AdminCandidatesPage() {
  const { isAdmin, isRh, profile } = useAuth()
  const { store, deleteCandidato } = useData()
  const [listError, setListError] = useState('')

  const unitIds = useMemo(
    () => (isAdmin || isRh ? store.units.map((u) => u.id) : [profile?.unit_id || store.units[0]?.id]),
    [isAdmin, isRh, profile?.unit_id, store.units],
  )

  const scopedVagas = useMemo(
    () => store.vagas.filter((v) => unitIds.includes(v.unit_id)),
    [store.vagas, unitIds],
  )

  const vagaIds = useMemo(() => new Set(scopedVagas.map((v) => v.id)), [scopedVagas])

  const [params, setParams] = useSearchParams()
  const statusFilter = statusFromQuery(params.get('status'))
  const [q, setQ] = useState('')
  const [unitFilter, setUnitFilter] = useState('all')
  const [vagaFilter, setVagaFilter] = useState('all')
  const [detail, setDetail] = useState<CandidateDetailData | null>(null)

  function setStatusFilter(next: string) {
    setParams(
      (prev) => {
        const updated = new URLSearchParams(prev)
        if (next === 'all') updated.delete('status')
        else updated.set('status', next === 'reprovada' ? 'banco' : next)
        return updated
      },
      { replace: true },
    )
  }

  const vagasForUnit =
    unitFilter === 'all' ? scopedVagas : scopedVagas.filter((v) => v.unit_id === unitFilter)

  const candidatos = useMemo(() => {
    return store.candidatos
      .filter((c) => vagaIds.has(c.vaga_id))
      .filter((c) => {
        const vaga = store.vagas.find((v) => v.id === c.vaga_id)
        if (unitFilter !== 'all' && vaga?.unit_id !== unitFilter) return false
        if (vagaFilter !== 'all' && c.vaga_id !== vagaFilter) return false
        if (statusFilter !== 'all' && c.status !== statusFilter) return false
        if (q.trim() && !c.nome.toLowerCase().includes(q.trim().toLowerCase())) return false
        return true
      })
      .sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em))
  }, [store, vagaIds, unitFilter, vagaFilter, statusFilter, q])

  function openCandidate(c: (typeof candidatos)[number]) {
    const vaga = store.vagas.find((v) => v.id === c.vaga_id) || null
    const unit = store.units.find((u) => u.id === vaga?.unit_id)
    setDetail({
      candidato: c,
      profile: store.profiles.find((p) => p.id === c.profile_id) || null,
      experiences: store.experiences.filter((e) => e.profile_id === c.profile_id),
      vaga,
      unitName: unit?.name,
    })
  }

  return (
    <div className="px-5 py-6 sm:px-8">
      <PageHeader
        eyebrow="Base"
        title={statusFilter === 'banco' ? 'Banco de talentos' : 'Candidatos'}
        description={
          statusFilter === 'banco'
            ? 'Pessoas que não foram escolhidas. O cadastro fica aqui para a próxima vaga.'
            : `${candidatos.length} resultado${candidatos.length === 1 ? '' : 's'} com os filtros atuais`
        }
      />

      {listError ? (
        <div className="mt-4">
          <Alert tone="error">{listError}</Alert>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nome" labelClassName="text-[var(--pv-cream)]/75">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome" />
        </Field>
        <Field label="Unidade" labelClassName="text-[var(--pv-cream)]/75">
          <Select
            value={unitFilter}
            onChange={(e) => {
              setUnitFilter(e.target.value)
              setVagaFilter('all')
            }}
          >
            <option value="all">Todas</option>
            {store.units
              .filter((u) => unitIds.includes(u.id))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Vaga" labelClassName="text-[var(--pv-cream)]/75">
          <Select value={vagaFilter} onChange={(e) => setVagaFilter(e.target.value)}>
            <option value="all">Todas</option>
            {vagasForUnit.map((v) => (
              <option key={v.id} value={v.id}>
                {v.titulo}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" labelClassName="text-[var(--pv-cream)]/75">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl bg-[var(--pv-surface)] shadow-xl">
        <div className="overflow-x-auto">
          <table className="pv-table w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white">
              <tr className="border-b border-[var(--pv-line)] text-[11px] uppercase tracking-wide text-[var(--pv-muted)]">
                <th className="px-5 py-4 font-bold">Nome</th>
                <th className="px-5 py-4 font-bold">Vaga</th>
                <th className="px-5 py-4 font-bold">Unidade</th>
                <th className="px-5 py-4 font-bold">Status</th>
                <th className="px-5 py-4 font-bold" />
              </tr>
            </thead>
            <tbody>
              {candidatos.map((c) => {
                const vaga = store.vagas.find((v) => v.id === c.vaga_id)
                const unit = store.units.find((u) => u.id === vaga?.unit_id)
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-[#F1EDE0]"
                    tabIndex={0}
                    onClick={() => openCandidate(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openCandidate(c)
                      }
                    }}
                  >
                    <td className="px-5 py-3.5 font-semibold text-[var(--pv-ink)]">{c.nome}</td>
                    <td className="px-5 py-3.5 font-medium text-[var(--pv-ink)]">{vaga?.titulo}</td>
                    <td className="px-5 py-3.5 text-[var(--pv-muted)]">{unit?.name}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        label={STATUS_META[c.status].label}
                        color={STATUS_META[c.status].color}
                        bg={STATUS_META[c.status].bg}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          className="font-semibold text-[#B23B3B] hover:underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!confirm(`Excluir ${c.nome}? A candidatura e o currículo saem do painel.`)) return
                            void deleteCandidato(c.id)
                              .then(() => {
                                setListError('')
                                if (detail?.candidato.id === c.id) setDetail(null)
                              })
                              .catch((err: unknown) => {
                                setListError(err instanceof Error ? err.message : 'Não foi possível excluir o candidato.')
                              })
                          }}
                        >
                          Excluir
                        </button>
                        <Link
                          to={`/admin/vagas/${c.vaga_id}`}
                          className="font-semibold text-[var(--pv-terracotta)] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Pipeline →
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {candidatos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#A9A493]">
                    {statusFilter === 'banco'
                      ? 'Ninguém no banco de talentos ainda'
                      : 'Nenhum candidato com esses filtros'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <CandidateDetailModal open={Boolean(detail)} data={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
