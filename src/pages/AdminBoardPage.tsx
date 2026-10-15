import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { generateVagaDraft } from '@/lib/aiVaga'
import { Button, Field, Input, Modal, PageHeader, Select, Textarea, Alert } from '@/components/ui'
import { EmptyState } from '@/components/Layout'
import { VagaPipeline } from '@/components/VagaPipeline'

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
        title="Pipeline das vagas"
        description="Cada vaga mostra em que etapa estão as pessoas. Abra o quadro para mover alguém."
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
        <div className="mt-7 space-y-8">
          {visibleUnits.map((unit) => {
            const vagas = store.vagas.filter((v) => v.unit_id === unit.id)
            return (
              <section key={unit.id} className="space-y-3">
                <h2 className="font-display text-xl text-[#F7F4EC]">{unit.name}</h2>
                {vagas.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/20 px-4 py-8 text-center text-sm text-[#EFE3C4]">
                    Nenhuma vaga nesta unidade
                  </p>
                ) : (
                  vagas.map((vaga) => (
                    <VagaPipeline
                      key={vaga.id}
                      vaga={vaga}
                      unitName={unit.name}
                      candidatos={store.candidatos.filter((c) => c.vaga_id === vaga.id)}
                    />
                  ))
                )}
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
