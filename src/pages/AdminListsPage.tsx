import { useMemo, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { countByStatus } from '@/lib/mockData'
import { Button, Field, Input, Select, StatusPill, Textarea } from '@/components/ui'
import { STATUS_META, type CandidateStatus, type Vaga } from '@/types'
import { formatDateBR } from '@/lib/utils'

type VagaForm = {
  unitId: string
  titulo: string
  descricao: string
  localidade: string
  tipo: string
  ativa: boolean
}

const emptyForm = (unitId = ''): VagaForm => ({
  unitId,
  titulo: '',
  descricao: '',
  localidade: '',
  tipo: 'Presencial',
  ativa: true,
})

export function AdminVagasListPage() {
  const { isAdmin, profile } = useAuth()
  const { store, addVaga, updateVaga, deleteVaga } = useData()

  const unitIds = isAdmin
    ? store.units.map((u) => u.id)
    : [profile?.unit_id || store.units[0]?.id]

  const vagas = store.vagas.filter((v) => unitIds.includes(v.unit_id))
  const units = store.units.filter((u) => unitIds.includes(u.id))

  const [detail, setDetail] = useState<Vaga | null>(null)
  const [editing, setEditing] = useState<Vaga | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<VagaForm>(emptyForm())

  function openCreate() {
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
    })
  }

  function saveForm() {
    if (!form.titulo.trim() || !form.unitId) return
    if (editing) {
      updateVaga(editing.id, {
        unit_id: form.unitId,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        localidade: form.localidade.trim(),
        tipo: form.tipo,
        ativa: form.ativa,
      })
    } else {
      addVaga({
        unitId: form.unitId,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        localidade: form.localidade.trim(),
        tipo: form.tipo,
        ativa: form.ativa,
      })
    }
    setCreating(false)
    setEditing(null)
  }

  function removeVaga(vaga: Vaga, e?: MouseEvent) {
    e?.stopPropagation()
    if (!confirm(`Excluir a vaga "${vaga.titulo}" e seus candidatos?`)) return
    deleteVaga(vaga.id)
    if (detail?.id === vaga.id) setDetail(null)
  }

  return (
    <div className="px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-[#F7F4EC]">Vagas</h1>
          <p className="mt-1 text-sm text-[var(--pv-cream)]/70">{vagas.length} vagas cadastradas</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Adicionar nova vaga
        </Button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {vagas.map((vaga) => {
          const unit = store.units.find((u) => u.id === vaga.unit_id)
          const cands = store.candidatos.filter((c) => c.vaga_id === vaga.id)
          const counts = countByStatus(cands)
          return (
            <button
              key={vaga.id}
              type="button"
              onClick={() => setDetail(vaga)}
              className="rounded-2xl bg-[#FBF9F3] p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
                  {unit?.name}
                </p>
                <div className="flex gap-1">
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded-lg bg-[#F1EDE0] p-1.5 text-[var(--pv-navy)] hover:bg-[#E7E2D3]"
                    onClick={(e) => openEdit(vaga, e)}
                    onKeyDown={(e) => e.key === 'Enter' && openEdit(vaga)}
                  >
                    <Pencil size={14} />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded-lg bg-[#FBEAEA] p-1.5 text-[#B23B3B] hover:bg-[#f5d5d5]"
                    onClick={(e) => removeVaga(vaga, e)}
                    onKeyDown={(e) => e.key === 'Enter' && removeVaga(vaga)}
                  >
                    <Trash2 size={14} />
                  </span>
                </div>
              </div>
              <h2 className="mt-1 font-display text-xl text-[var(--pv-navy)]">{vaga.titulo}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-[#6B664F]">{vaga.descricao}</p>
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

      {detail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(14,23,48,0.55)] p-5">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#FBF9F3] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
                  {store.units.find((u) => u.id === detail.unit_id)?.name}
                </p>
                <h3 className="font-display text-2xl text-[var(--pv-navy)]">{detail.titulo}</h3>
              </div>
              <button type="button" className="rounded-lg p-2 hover:bg-[#F1EDE0]" onClick={() => setDetail(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[#4A4636]">
              <p>
                <strong>Local:</strong> {detail.localidade || '—'}
              </p>
              <p>
                <strong>Tipo:</strong> {detail.tipo || '—'}
              </p>
              <p>
                <strong>Status:</strong> {detail.ativa ? 'Ativa' : 'Inativa'}
              </p>
              <p>
                <strong>Criada em:</strong> {formatDateBR(detail.criada_em)}
              </p>
              <p className="whitespace-pre-wrap rounded-xl bg-white p-3 border border-[#E7E2D3]">
                {detail.descricao}
              </p>
              <p>
                <strong>Candidatos:</strong>{' '}
                {store.candidatos.filter((c) => c.vaga_id === detail.id).length}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  openEdit(detail)
                }}
              >
                <Pencil size={14} /> Editar
              </Button>
              <Link to={`/admin/vagas/${detail.id}`}>
                <Button>Abrir pipeline</Button>
              </Link>
              <Button variant="danger" onClick={() => removeVaga(detail)}>
                <Trash2 size={14} /> Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {(creating || editing) && (
        <VagaFormModal
          title={editing ? 'Editar vaga' : 'Nova vaga'}
          form={form}
          units={units}
          onChange={setForm}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={saveForm}
        />
      )}
    </div>
  )
}

function VagaFormModal({
  title,
  form,
  units,
  onChange,
  onClose,
  onSave,
}: {
  title: string
  form: VagaForm
  units: { id: string; name: string }[]
  onChange: (f: VagaForm) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(14,23,48,0.55)] p-5">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[#FBF9F3] p-5 shadow-2xl">
        <h3 className="font-display text-xl text-[var(--pv-navy)]">{title}</h3>
        <div className="mt-4 space-y-3">
          <Field label="Unidade">
            <Select value={form.unitId} onChange={(e) => onChange({ ...form, unitId: e.target.value })}>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Título *">
            <Input value={form.titulo} onChange={(e) => onChange({ ...form, titulo: e.target.value })} />
          </Field>
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
          <Field label="Descrição">
            <Textarea
              rows={4}
              value={form.descricao}
              onChange={(e) => onChange({ ...form, descricao: e.target.value })}
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
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSave}>Salvar</Button>
        </div>
      </div>
    </div>
  )
}

export function AdminCandidatesPage() {
  const { isAdmin, profile } = useAuth()
  const { store } = useData()

  const unitIds = isAdmin
    ? store.units.map((u) => u.id)
    : [profile?.unit_id || store.units[0]?.id]

  const scopedVagas = store.vagas.filter((v) => unitIds.includes(v.unit_id))
  const vagaIds = new Set(scopedVagas.map((v) => v.id))

  const [q, setQ] = useState('')
  const [unitFilter, setUnitFilter] = useState('all')
  const [vagaFilter, setVagaFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

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

  return (
    <div className="px-5 py-6 sm:px-8">
      <h1 className="font-display text-3xl text-[#F7F4EC]">Candidatos</h1>
      <p className="mt-1 text-sm text-[var(--pv-cream)]/70">
        {candidatos.length} resultado{candidatos.length === 1 ? '' : 's'}
      </p>

      <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nome">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome" />
        </Field>
        <Field label="Unidade">
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
        <Field label="Vaga">
          <Select value={vagaFilter} onChange={(e) => setVagaFilter(e.target.value)}>
            <option value="all">Todas</option>
            {vagasForUnit.map((v) => (
              <option key={v.id} value={v.id}>
                {v.titulo}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todos</option>
            {(Object.keys(STATUS_META) as CandidateStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl bg-[#FBF9F3] shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white">
              <tr className="border-b border-[#E7E2D3] text-[11px] uppercase tracking-wide text-[#6B664F]">
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
                  <tr key={c.id} className="border-b border-[#F1EDE0]">
                    <td className="px-5 py-3.5 font-semibold text-[var(--pv-navy)]">{c.nome}</td>
                    <td className="px-5 py-3.5">{vaga?.titulo}</td>
                    <td className="px-5 py-3.5 text-[#6B664F]">{unit?.name}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        label={STATUS_META[c.status].label}
                        color={STATUS_META[c.status].color}
                        bg={STATUS_META[c.status].bg}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link to={`/admin/vagas/${c.vaga_id}`} className="font-semibold text-[var(--pv-terracotta)]">
                        Pipeline →
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {candidatos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[#A9A493]">
                    Nenhum candidato com esses filtros
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
