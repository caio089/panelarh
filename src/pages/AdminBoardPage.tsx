import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { countByStatus } from '@/lib/mockData'
import { STATUS_META, type CandidateStatus, type Vaga } from '@/types'
import { Button, Field, Input, Select, StatusPill, Textarea } from '@/components/ui'

export function AdminBoardPage() {
  const { profile, isAdmin } = useAuth()
  const { store, addVaga } = useData()
  const [openForm, setOpenForm] = useState(false)
  const [form, setForm] = useState({
    unitId: '',
    titulo: '',
    descricao: '',
    localidade: '',
  })

  const visibleUnits = useMemo(() => {
    if (isAdmin) return store.units
    const id = profile?.unit_id || store.units[0]?.id
    return store.units.filter((u) => u.id === id)
  }, [store.units, profile, isAdmin])

  function openNew() {
    setForm({
      unitId: visibleUnits[0]?.id || '',
      titulo: '',
      descricao: '',
      localidade: '',
    })
    setOpenForm(true)
  }

  function submit() {
    if (!form.titulo.trim() || !form.unitId) return
    addVaga({
      unitId: form.unitId,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || undefined,
      localidade: form.localidade.trim() || undefined,
    })
    setOpenForm(false)
  }

  return (
    <div className="px-5 py-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--pv-terracotta)]">
            Operação
          </p>
          <h1 className="font-display text-3xl text-[#F7F4EC]">Quadro por unidades</h1>
          <p className="mt-1 text-sm text-[var(--pv-cream)]/70">
            Centro, Sudeste, Norte — vagas e volume de candidatos em cada casa.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Nova vaga
        </Button>
      </div>

      <div className="pv-scroll flex gap-4 overflow-x-auto pb-6">
        {visibleUnits.map((unit) => {
          const vagas = store.vagas.filter((v) => v.unit_id === unit.id)
          return (
            <section
              key={unit.id}
              className="flex max-h-[calc(100vh-180px)] w-[300px] min-w-[300px] flex-shrink-0 flex-col rounded-[14px] bg-[rgba(247,244,236,0.97)] shadow-[0_12px_30px_rgba(0,0,0,0.25)]"
            >
              <div className="flex items-center justify-between rounded-t-[14px] bg-[var(--pv-navy)] px-4 py-3.5">
                <h2 className="text-[13px] font-bold uppercase tracking-[0.4px] text-[#F7F4EC]">
                  {unit.name}
                </h2>
                <span className="rounded-full bg-[rgba(239,227,196,0.15)] px-2.5 py-0.5 text-xs font-bold text-[var(--pv-cream)]">
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
                  <p className="py-8 text-center text-xs italic text-[#A9A493]">Nenhuma vaga nesta unidade</p>
                ) : null}
              </div>
            </section>
          )
        })}
      </div>

      {openForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(14,23,48,0.55)] p-5">
          <div className="w-full max-w-md rounded-2xl bg-[#FBF9F3] p-5 shadow-2xl">
            <h3 className="font-display text-xl text-[var(--pv-navy)]">Nova vaga</h3>
            <div className="mt-4 space-y-3">
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
                />
              </Field>
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
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenForm(false)}>
                Cancelar
              </Button>
              <Button onClick={submit}>Criar vaga</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VagaCard({ vaga, candidatos }: { vaga: Vaga; candidatos: { id: string; status: CandidateStatus }[] }) {
  const counts = countByStatus(candidatos as import('@/types').Candidato[])
  const total = candidatos.length
  return (
    <Link
      to={`/admin/vagas/${vaga.id}`}
      className="block rounded-[10px] border border-[#E7E2D3] bg-white px-3.5 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-bold text-[var(--pv-navy)]">{vaga.titulo}</div>
        {!vaga.ativa ? (
          <span className="rounded-full bg-[#F1EDE0] px-2 py-0.5 text-[10px] font-bold text-[#6B664F]">
            Inativa
          </span>
        ) : null}
      </div>
      {total === 0 ? (
        <div className="mt-2 text-[11.5px] italic text-[#A9A493]">Nenhum candidato ainda</div>
      ) : (
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
      )}
    </Link>
  )
}
