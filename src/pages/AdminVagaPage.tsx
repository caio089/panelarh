import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowLeft, MessageCircle, Trash2, X, UserRound } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { DISC_LABELS } from '@/lib/disc'
import { formatDateBR } from '@/lib/utils'
import { openWhatsAppChat, whatsAppMessageForStatus } from '@/lib/whatsapp'
import { phoneFromCandidatoInfo } from '@/lib/candidatoInfo'
import type { Candidato, CandidateStatus, Experience, Profile } from '@/types'
import { PIPELINE_ORDER, STATUS_META } from '@/types'
import { Alert, Button, Field, Input, StatusPill, Textarea } from '@/components/ui'
import { ProfileAnswers } from '@/components/ProfileAnswers'

type CandFull = Omit<Candidato, 'profile'> & { profile?: Profile | null; experiences?: Experience[] }

export function AdminVagaPage() {
  const { id } = useParams()
  const { user, isStaff } = useAuth()
  const { store, getVaga, getCandidatosByVaga, updateCandidatoStatus, deleteCandidato, deleteVaga, sendMessage } =
    useData()

  const vaga = id ? getVaga(id) : undefined
  const cands = useMemo<CandFull[]>(() => {
    if (!id) return []
    return getCandidatosByVaga(id).map((c) => ({
      ...c,
      profile: store.profiles.find((p) => p.id === c.profile_id) || null,
      experiences: store.experiences.filter((e) => e.profile_id === c.profile_id),
    }))
  }, [id, getCandidatosByVaga, store])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [selected, setSelected] = useState<CandFull | null>(null)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyBody, setNotifyBody] = useState('')
  const [notifyError, setNotifyError] = useState('')
  const [trainingDate, setTrainingDate] = useState('')
  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: CandidateStatus } | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const columns = useMemo(() => {
    const map: Record<CandidateStatus, CandFull[]> = {
      pendente: [],
      entrevista: [],
      aprovada: [],
      banco: [],
      reprovada: [],
    }
    cands.forEach((c) => {
      const key = (c.status in map ? c.status : 'pendente') as CandidateStatus
      map[key].push(c)
    })
    return map
  }, [cands])

  if (!isStaff) return <Navigate to="/admin/login" replace />
  if (!vaga) {
    return (
      <div className="px-5 py-16 sm:px-8">
        <p className="font-display text-2xl text-[#F7F4EC]">Vaga não encontrada</p>
        <p className="mt-2 text-sm text-[var(--pv-cream)]/70">Ela pode ter sido removida.</p>
        <Link
          to="/admin/quadro"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--pv-terracotta)]"
        >
          <ArrowLeft size={14} /> Voltar ao quadro
        </Link>
      </div>
    )
  }

  const vagaTitle = vaga.titulo
  const vagaUnitName = vaga.unitName
  const vagaId = vaga.id

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const candId = String(active.id)
    const overId = String(over.id)
    let nextStatus: CandidateStatus | null = null
    if (PIPELINE_ORDER.includes(overId as CandidateStatus)) nextStatus = overId as CandidateStatus
    else {
      const overCand = cands.find((c) => c.id === overId)
      if (overCand) nextStatus = overCand.status
    }
    const cand = cands.find((c) => c.id === candId)
    if (!cand || !nextStatus || cand.status === nextStatus) return
    if (nextStatus === 'aprovada') {
      setPendingStatus({ id: candId, status: nextStatus })
      setTrainingDate('')
      return
    }
    updateCandidatoStatus(candId, nextStatus)
    setSelected({ ...cand, status: nextStatus })
    setNotifyError('')
    setNotifyBody(
      whatsAppMessageForStatus({
        nome: cand.nome,
        vaga: vagaTitle,
        status: nextStatus,
      }),
    )
    setNotifyOpen(true)
  }

  const activeCand = cands.find((c) => c.id === activeId)

  return (
    <div>
      <header className="border-b border-white/10 px-5 py-5 sm:px-8">
        <Link
          to="/admin/quadro"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--pv-cream)]/75 transition hover:text-[var(--pv-cream)]"
        >
          <ArrowLeft size={14} /> Quadro
        </Link>
        <p className="pv-eyebrow mt-3">{vagaUnitName}</p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-[#F7F4EC] sm:text-3xl">{vagaTitle}</h1>
            <p className="mt-1 text-sm pv-cream-text">
              {cands.length} candidato{cands.length === 1 ? '' : 's'} no pipeline · arraste entre colunas
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Excluir a vaga "${vagaTitle}"?`)) {
                deleteVaga(vagaId)
                window.location.href = '/admin/quadro'
              }
            }}
          >
            <Trash2 size={14} /> Excluir vaga
          </Button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
      >
        <div className="pv-scroll flex gap-4 overflow-x-auto px-5 py-6 sm:px-8">
          {PIPELINE_ORDER.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              items={columns[status]}
              onOpen={setSelected}
              onDelete={(c) => {
                if (confirm(`Excluir ${c.nome}?`)) {
                  deleteCandidato(c.id)
                  if (selected?.id === c.id) setSelected(null)
                }
              }}
            />
          ))}
        </div>
        <DragOverlay>{activeCand ? <CandCard cand={activeCand} dragging /> : null}</DragOverlay>
      </DndContext>

      {selected && (
        <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-md overflow-y-auto border-l border-[#E7E2D3] bg-[#FBF9F3] shadow-2xl">
          <div className="flex items-start justify-between border-b border-[#E7E2D3] bg-white px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">Perfil</p>
              <h2 className="font-display text-xl text-[var(--pv-navy)]">{selected.nome}</h2>
              <div className="mt-2">
                <StatusPill
                  label={STATUS_META[selected.status].label}
                  color={STATUS_META[selected.status].color}
                  bg={STATUS_META[selected.status].bg}
                />
              </div>
            </div>
            <button type="button" className="rounded-lg p-2 hover:bg-[#F1EDE0]" onClick={() => setSelected(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="space-y-5 p-5 text-sm">
            <section>
              <h3 className="mb-2 flex items-center gap-2 font-bold text-[var(--pv-navy)]">
                <UserRound size={15} /> Dados
              </h3>
              <ProfileAnswers profile={selected.profile} candidato={selected} />
              {selected.data_inicio_treinamento ? (
                <p className="mt-2 text-[#4A4636]">
                  Início treinamento: {formatDateBR(selected.data_inicio_treinamento)}
                </p>
              ) : null}
            </section>

            {selected.experiencia && selected.profile?.relevant_experience ? (
              <section>
                <h3 className="mb-2 font-bold text-[var(--pv-navy)]">Experiência</h3>
                <div className="rounded-xl border border-[#E7E2D3] bg-white p-3">{selected.experiencia}</div>
              </section>
            ) : null}

            <section>
              <h3 className="mb-2 font-bold text-[var(--pv-navy)]">DISC</h3>
              {selected.profile?.disc_d != null ? (
                <div className="grid grid-cols-2 gap-2">
                  {(['D', 'I', 'S', 'C'] as const).map((d) => {
                    const val =
                      d === 'D'
                        ? selected.profile?.disc_d
                        : d === 'I'
                          ? selected.profile?.disc_i
                          : d === 'S'
                            ? selected.profile?.disc_s
                            : selected.profile?.disc_c
                    return (
                      <div key={d} className="rounded-xl bg-[var(--pv-navy)] px-3 py-3 text-[var(--pv-cream)]">
                        <div className="text-[11px] opacity-80">{DISC_LABELS[d]}</div>
                        <div className="font-display text-2xl">{Number(val || 0)}%</div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                          <div className="h-full bg-[var(--pv-terracotta)]" style={{ width: `${Number(val || 0)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="italic text-[#A9A493]">Sem DISC</p>
              )}
            </section>

            <Button
              className="w-full"
              onClick={() => {
                setNotifyError('')
                setNotifyBody(
                  whatsAppMessageForStatus({
                    nome: selected.nome,
                    vaga: vagaTitle,
                    status: selected.status,
                    trainingDate: selected.data_inicio_treinamento,
                  }),
                )
                setNotifyOpen(true)
              }}
            >
              <MessageCircle size={15} /> Enviar WhatsApp
            </Button>
          </div>
        </aside>
      )}

      {notifyOpen && selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(14,23,48,0.55)] p-5">
          <div className="w-full max-w-md rounded-2xl bg-[#FBF9F3] p-5 shadow-2xl">
            <h3 className="font-display text-xl text-[var(--pv-navy)]">Enviar no WhatsApp</h3>
            <p className="mt-1 text-sm text-[var(--pv-muted)]">
              A mensagem abre no WhatsApp com o número do candidato.
            </p>
            <div className="mt-4">
              <Field label="Mensagem">
                <Textarea value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} rows={5} />
              </Field>
            </div>
            {notifyError ? (
              <div className="mt-3">
                <Alert tone="error">{notifyError}</Alert>
              </div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setNotifyOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!notifyBody.trim()) return
                  const sent = openWhatsAppChat(
                    phoneFromCandidatoInfo(selected.info_complementar, selected.profile?.phone),
                    notifyBody.trim(),
                  )
                  if (sent.error) {
                    setNotifyError(sent.error)
                    return
                  }
                  if (user) sendMessage(selected.id, user.id, notifyBody.trim())
                  setNotifyOpen(false)
                }}
              >
                <MessageCircle size={15} /> Abrir WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingStatus && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(14,23,48,0.55)] p-5">
          <div className="w-full max-w-md rounded-2xl bg-[#FBF9F3] p-5 shadow-2xl">
            <h3 className="font-display text-xl text-[var(--pv-navy)]">Aprovar candidato</h3>
            <div className="mt-4">
              <Field label="Data de início do treinamento">
                <Input type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} />
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingStatus(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  const cand = cands.find((c) => c.id === pendingStatus.id)
                  updateCandidatoStatus(pendingStatus.id, 'aprovada', trainingDate || null)
                  setPendingStatus(null)
                  if (cand) {
                    setSelected({ ...cand, status: 'aprovada' })
                    setNotifyError('')
                    setNotifyBody(
                      whatsAppMessageForStatus({
                        nome: cand.nome,
                        vaga: vagaTitle,
                        status: 'aprovada',
                        trainingDate: trainingDate || null,
                      }),
                    )
                    setNotifyOpen(true)
                  }
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KanbanColumn({
  status,
  items,
  onOpen,
  onDelete,
}: {
  status: CandidateStatus
  items: CandFull[]
  onOpen: (c: CandFull) => void
  onDelete: (c: CandFull) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const meta = STATUS_META[status]
  return (
    <section
      ref={setNodeRef}
      className={`flex max-h-[calc(100vh-200px)] w-[260px] min-w-[260px] flex-shrink-0 flex-col rounded-[14px] bg-[rgba(247,244,236,0.97)] shadow-xl ${
        isOver ? 'ring-2 ring-[var(--pv-terracotta)]' : ''
      }`}
    >
      <div className="flex items-center justify-between rounded-t-[14px] px-4 py-3.5" style={{ background: meta.color }}>
        <h2 className="text-[12px] font-bold uppercase tracking-[0.4px] text-white">{meta.label}</h2>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold text-white">{items.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3">
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((cand) => (
            <SortableCand key={cand.id} cand={cand} onOpen={() => onOpen(cand)} onDelete={() => onDelete(cand)} />
          ))}
        </SortableContext>
        {items.length === 0 ? <p className="py-6 text-center text-[12px] italic text-[#A9A493]">Arraste aqui</p> : null}
      </div>
    </section>
  )
}

function SortableCand({
  cand,
  onOpen,
  onDelete,
}: {
  cand: CandFull
  onOpen: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cand.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <CandCard cand={cand} onOpen={onOpen} onDelete={onDelete} />
    </div>
  )
}

function CandCard({
  cand,
  onOpen,
  onDelete,
  dragging,
}: {
  cand: CandFull
  onOpen?: () => void
  onDelete?: () => void
  dragging?: boolean
}) {
  return (
    <div className={`rounded-[10px] border border-[#E7E2D3] bg-white p-3 shadow-sm ${dragging ? 'ring-2 ring-[var(--pv-terracotta)]' : ''}`}>
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <div className="text-sm font-bold text-[var(--pv-navy)]">{cand.nome}</div>
        <div className="mt-1 text-[11.5px] text-[#6B664F]">{cand.profile?.city || cand.profile?.desired_role || 'Candidato'}</div>
      </button>
      {onDelete ? (
        <button type="button" className="mt-2 text-[11px] font-semibold text-[#B23B3B]" onClick={onDelete}>
          Excluir
        </button>
      ) : null}
    </div>
  )
}
