import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { Alert, Button, Field, Input, Modal, PageHeader } from '@/components/ui'
import { EmptyState } from '@/components/Layout'
import type { Unit } from '@/types'

export function AdminUnitsPage() {
  const { isAdmin } = useAuth()
  const { store, addUnit, updateUnit, deleteUnit } = useData()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Unit | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (!isAdmin) return <Navigate to="/admin/rh" replace />

  function openCreate() {
    setError('')
    setEditing(null)
    setName('')
    setCreating(true)
  }

  function openEdit(unit: Unit) {
    setError('')
    setCreating(false)
    setEditing(unit)
    setName(unit.name)
  }

  function closeForm() {
    setCreating(false)
    setEditing(null)
    setName('')
    setError('')
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      if (editing) await updateUnit(editing.id, name)
      else await addUnit(name)
      closeForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a unidade.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(unit: Unit) {
    const vagas = store.vagas.filter((v) => v.unit_id === unit.id).length
    const ok = confirm(
      vagas > 0
        ? `Excluir "${unit.name}" também remove ${vagas} vaga${vagas === 1 ? '' : 's'} e os candidatos. Continuar?`
        : `Excluir a unidade "${unit.name}"?`,
    )
    if (!ok) return
    try {
      await deleteUnit(unit.id)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Não foi possível excluir a unidade.')
    }
  }

  const formOpen = creating || Boolean(editing)

  return (
    <div className="px-5 py-6 sm:px-8">
      <PageHeader
        eyebrow="Cadastro"
        title="Unidades"
        description={`${store.units.length} unidade${store.units.length === 1 ? '' : 's'} cadastrada${store.units.length === 1 ? '' : 's'}`}
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} /> Nova unidade
          </Button>
        }
      />

      {store.units.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            tone="dark"
            title="Nenhuma unidade ainda"
            description="Cadastre as casas da Panela Velha para publicar vagas e receber candidatos."
            action={
              <Button onClick={openCreate}>
                <Plus size={16} /> Criar unidade
              </Button>
            }
          />
        </div>
      ) : (
        <div className="pv-stagger mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {store.units.map((unit) => {
            const vagas = store.vagas.filter((v) => v.unit_id === unit.id)
            const candidatos = store.candidatos.filter((c) => vagas.some((v) => v.id === c.vaga_id))
            return (
              <article
                key={unit.id}
                className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-lg"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F8E8E3] text-[var(--pv-terracotta)]">
                      <Building2 size={16} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-lg leading-snug text-[var(--pv-ink)]">
                        {unit.name}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--pv-muted)]">
                        {vagas.length} vaga{vagas.length === 1 ? '' : 's'} · {candidatos.length}{' '}
                        candidato{candidatos.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label="Editar unidade"
                      className="rounded-lg bg-[#F1EDE0] p-1.5 text-[var(--pv-navy)] hover:bg-[#E7E2D3]"
                      onClick={() => openEdit(unit)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Excluir unidade"
                      className="rounded-lg bg-[#FBEAEA] p-1.5 text-[#B23B3B] hover:bg-[#F4D4D4]"
                      onClick={() => void remove(unit)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal open={formOpen} title={editing ? 'Editar unidade' : 'Nova unidade'} onClose={closeForm}>
        <Field label="Nome da unidade *">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Mocambinho"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
            }}
          />
        </Field>
        {error ? (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={closeForm}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={!name.trim() || saving}>
            {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar unidade'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
