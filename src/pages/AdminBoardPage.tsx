import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { countByStatus } from '@/lib/data'
import { generateVagaDraft } from '@/lib/aiVaga'
import { STATUS_META, type CandidateStatus, type Vaga } from '@/types'
import { Button, Field, Input, Modal, PageHeader, Select, StatusPill, Textarea, Alert } from '@/components/ui'
import { EmptyState } from '@/components/Layout'

export function AdminBoardPage() {
  const { profile, isAdmin, isRh } = useAuth()
  const { store, addVaga } = useData()
  const [openForm, setOpenForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [form, setForm] = useState({
    unitId: '',
    titulo: '',
    descricao: '',
    localidade: '',
  })

  const visibleUnits = useMemo(() => {
    if (isAdmin || isRh) return store.units
    const id = profile?.unit_id || store.units[0]?.id
    return store.units.filter((u) => u.id === id)
  }, [store.units, profile, isAdmin, isRh])

  function fillWithAi() {
    if (!form.titulo.trim() || aiLoading) return
    setAiLoading(true)
    window.setTimeout(() => {
      const unitName = visibleUnits.find((u) => u.id === form.unitId)?.name
      const draft = generateVagaDraft({ titulo: form.titulo, unitName })
      setForm((prev) => ({
        ...prev,
        descricao: draft.descricao,
        localidade: prev.localidade.trim() || draft.localidade,
      }))
      setAiLoading(false)
    }, 700)
  }

  function openNew() {
    setFormError('')
    setForm({
      unitId: visibleUnits[0]?.id || '',
      titulo: '',
      descricao: '',
      localidade: '',
    })
    setOpenForm(true)
  }

  async function submit() {
    if (!form.titulo.trim() || !form.unitId) return
    setSaving(true)
    setFormError('')
    try {
      await addVaga({
        unitId: form.unitId,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || undefined,
        localidade: form.localidade.trim() || undefined,
      })
      setOpenForm(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar a vaga.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-5 py-6 sm:px-8">
      <PageHeader
        eyebrow="Operação"
        title="Quadro por unidades"
        description="Vagas e volume de candidatos em cada casa cadastrada."
        actions={
          visibleUnits.length === 0 && isAdmin ? (
            <Link to="/admin/unidades">
              <Button>
                <Plus size={16} /> Cadastrar unidade
              </Button>
            </Link>
          ) : (
            <Button onClick={openNew} disabled={visibleUnits.length === 0}>
              <Plus size={16} /> Nova vaga
            </Button>
          )
        }
      />

      {visibleUnits.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            tone="dark"
            title="Nenhuma unidade disponível"
            description={
              isAdmin
                ? 'Cadastre as unidades da Panela Velha para montar o quadro.'
                : 'Nenhuma unidade foi atribuída ao seu perfil.'
            }
            action={
              isAdmin ? (
                <Link to="/admin/unidades">
                  <Button>
                    <Plus size={16} /> Criar unidade
                  </Button>
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="pv-scroll mt-7 flex gap-4 overflow-x-auto pb-6">
          {visibleUnits.map((unit) => {
            const vagas = store.vagas.filter((v) => v.unit_id === unit.id)
            return (
              <section
                key={unit.id}
                className="flex max-h-[calc(100vh-180px)] w-[320px] min-w-[320px] flex-shrink-0 flex-col overflow-hidden rounded-2xl bg-[rgba(247,244,236,0.97)] shadow-[0_12px_30px_rgba(0,0,0,0.25)]"
              >
                <div className="flex items-center justify-between bg-[var(--pv-navy)] px-4 py-3.5">
                  <h2 className="text-[13px] font-bold uppercase tracking-[0.4px] text-[#F7F4EC]">
                    {unit.name}
                  </h2>
                  <span className="rounded-md bg-[rgba(239,227,196,0.15)] px-2.5 py-0.5 text-xs font-bold text-[var(--pv-cream)]">
                    {vagas.length}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3.5">
                  {vagas.map((vaga) => (
                    <VagaCard
                      key={vaga.id}
                      vaga={vaga}
                      candidatos={store.candidatos.filter((c) => c.vaga_id === vaga.id)}
                    />
                  ))}
                  {vagas.length === 0 ? (
                    <p className="py-10 text-center text-xs text-[#A9A493]">
                      Nenhuma vaga nesta unidade
                    </p>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <Modal open={openForm} title="Nova vaga" onClose={() => setOpenForm(false)}>
        <div className="space-y-3">
          <Field label="Unidade">
            <Select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
              {visibleUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Título *">
            <Input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex: Chapeiro"
              autoFocus
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
            {aiLoading ? 'IA preenchendo…' : 'Preencher com IA'}
          </Button>
          <Field label="Localidade">
            <Input
              value={form.localidade}
              onChange={(e) => setForm({ ...form, localidade: e.target.value })}
              placeholder="Ex: Centro · SP"
            />
          </Field>
          <Field label="Descrição">
            <Textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={4}
            />
          </Field>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpenForm(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={!form.titulo.trim() || !form.unitId || saving || aiLoading}>
            {saving ? 'Salvando…' : 'Criar vaga'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function VagaCard({
  vaga,
  candidatos,
}: {
  vaga: Vaga
  candidatos: { id: string; nome: string; status: CandidateStatus }[]
}) {
  const counts = countByStatus(candidatos as import('@/types').Candidato[])
  const total = candidatos.length
  const preview = candidatos.slice(0, 3)

  return (
    <Link
      to={`/admin/vagas/${vaga.id}`}
      className="block rounded-xl border border-[var(--pv-line)] bg-white px-3.5 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--pv-terracotta)]/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-[13.5px] font-bold leading-snug text-[var(--pv-ink)]">
          {vaga.titulo}
        </div>
        {!vaga.ativa ? (
          <span className="shrink-0 rounded-md bg-[#F1EDE0] px-2 py-0.5 text-[10px] font-bold text-[#6B664F]">
            Inativa
          </span>
        ) : null}
      </div>
      {total === 0 ? (
        <div className="mt-2 text-[11.5px] text-[#A9A493]">Nenhum candidato ainda</div>
      ) : (
        <>
          <ul className="mt-2 space-y-0.5">
            {preview.map((c) => (
              <li key={c.id} className="truncate text-[12px] font-medium text-[var(--pv-ink)]">
                {c.nome}
              </li>
            ))}
            {total > preview.length ? (
              <li className="text-[11px] font-semibold text-[var(--pv-terracotta)]">
                +{total - preview.length} no pipeline
              </li>
            ) : null}
          </ul>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(Object.keys(STATUS_META) as CandidateStatus[]).map((status) =>
              counts[status] ? (
                <StatusPill
                  key={status}
                  label={`${STATUS_META[status].label.split(' ')[0]} ${counts[status]}`}
                  color={STATUS_META[status].color}
                  bg={STATUS_META[status].bg}
                />
              ) : null,
            )}
          </div>
        </>
      )}
    </Link>
  )
}
