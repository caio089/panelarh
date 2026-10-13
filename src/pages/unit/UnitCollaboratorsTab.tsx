import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pencil, Plus, Power, Search, Trash2, UserCheck, UserMinus, Users } from 'lucide-react'
import { Alert, Button } from '@/components/ui'
import { cn, formatDateBR } from '@/lib/utils'
import { useGestaoStore } from '@/features/gestao/GestaoStoreContext'
import type { CollaboratorInput } from '@/features/gestao/collaboratorValidation'
import { tenureLabel } from '@/features/gestao/dateUtils'
import { compareCargo, SCHEDULE_DAYS, SHIFT_PREFERENCE_LABEL } from '@/features/gestao/escala/rules'
import type { Colaborador, CollaboratorStatus } from '@/features/gestao/types'
import { Avatar, SectionCard } from '@/features/gestao/components/atoms'
import { CollaboratorFormModal } from '@/features/gestao/components/CollaboratorFormModal'
import { ConfirmDialog } from '@/features/gestao/components/ConfirmDialog'
import { useUnitContext } from './unitContext'

type StatusFilter = 'ativo' | 'inativo' | 'todos'

const FEEDBACK_DURATION_MS = 3500

/** Cadastro de colaboradores da unidade: criar, editar, inativar/reativar e excluir. */
export function UnitCollaboratorsTab() {
  const { unitId, unitName } = useUnitContext()
  const { colaboradores, addColaborador, updateColaborador, setColaboradorStatus, deleteColaborador } = useGestaoStore()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ativo')
  const [cargoFilter, setCargoFilter] = useState('')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Colaborador | null>(null)
  const [toDelete, setToDelete] = useState<Colaborador | null>(null)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(''), FEEDBACK_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const team = useMemo(() => colaboradores.filter((c) => c.unitId === unitId), [colaboradores, unitId])
  const activeTeam = team.filter((c) => c.status === 'ativo')
  const cargoCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of activeTeam) counts.set(c.cargo, (counts.get(c.cargo) ?? 0) + 1)
    return [...counts.entries()].sort(([a], [b]) => compareCargo(a, b))
  }, [activeTeam])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return team
      .filter((c) => statusFilter === 'todos' || c.status === statusFilter)
      .filter((c) => !cargoFilter || c.cargo === cargoFilter)
      .filter((c) => !q || c.nome.toLowerCase().includes(q) || c.telefone.includes(q))
      .sort((a, b) => compareCargo(a.cargo, b.cargo) || a.nome.localeCompare(b.nome))
  }, [team, statusFilter, cargoFilter, query])

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(c: Colaborador) {
    setEditing(c)
    setFormOpen(true)
  }

  function handleSubmit(input: CollaboratorInput) {
    if (editing) {
      updateColaborador(editing.id, input)
      setFeedback(`Dados de ${input.nome.split(' ')[0]} atualizados.`)
    } else {
      addColaborador(unitId, input)
      setFeedback(`${input.nome.split(' ')[0]} cadastrado(a) em ${unitName}.`)
    }
    setFormOpen(false)
  }

  function toggleStatus(c: Colaborador) {
    const next: CollaboratorStatus = c.status === 'ativo' ? 'inativo' : 'ativo'
    setColaboradorStatus(c.id, next)
    setFeedback(next === 'ativo' ? `${c.nome} foi reativado(a).` : `${c.nome} foi inativado(a) e sai das próximas escalas.`)
  }

  function confirmDelete() {
    if (!toDelete) return
    deleteColaborador(toDelete.id)
    setFeedback(`${toDelete.nome} foi excluído(a).`)
    setToDelete(null)
  }

  return (
    <div className="pv-stagger space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile icon={<Users size={18} />} label="Ativos" value={activeTeam.length} color="var(--pv-success)" />
        <SummaryTile
          icon={<UserMinus size={18} />}
          label="Inativos"
          value={team.length - activeTeam.length}
          color="var(--pv-muted)"
        />
        <article className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-muted)]">Equipe por cargo</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cargoCounts.map(([cargo, count]) => (
              <span key={cargo} className="rounded-md bg-white px-2 py-1 text-[11px] font-bold text-[var(--pv-ink)] shadow-sm">
                {cargo} <span className="text-[var(--pv-terracotta)]">{count}</span>
              </span>
            ))}
          </div>
        </article>
      </div>

      {feedback ? <Alert tone="success">{feedback}</Alert> : null}

      <SectionCard
        title="Colaboradores"
        subtitle="Cadastro usado no ponto, nas ocorrências e na escala da semana"
        action={
          <Button onClick={openNew}>
            <Plus size={16} /> Novo colaborador
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[#F1EDE0] p-1" role="tablist" aria-label="Status">
            {(['ativo', 'inativo', 'todos'] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold transition',
                  statusFilter === s ? 'bg-white text-[var(--pv-navy)] shadow-sm' : 'text-[var(--pv-muted)]',
                )}
              >
                {s === 'ativo' ? 'Ativos' : s === 'inativo' ? 'Inativos' : 'Todos'}
              </button>
            ))}
          </div>
          <select
            value={cargoFilter}
            onChange={(e) => setCargoFilter(e.target.value)}
            className="rounded-xl border border-[var(--pv-line-strong)] bg-white px-3 py-2 text-xs font-semibold text-[var(--pv-ink)] outline-none"
            aria-label="Filtrar por cargo"
          >
            <option value="">Todos os cargos</option>
            {cargoCounts.map(([cargo]) => (
              <option key={cargo} value={cargo}>
                {cargo}
              </option>
            ))}
          </select>
          <label className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9A493]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              maxLength={60}
              className="w-60 rounded-xl border border-[var(--pv-line-strong)] bg-white py-2 pl-8 pr-3 text-xs text-[var(--pv-ink)] outline-none focus:border-[var(--pv-terracotta)]"
            />
          </label>
        </div>

        <div className="pv-scroll overflow-x-auto rounded-xl border border-[var(--pv-line)] bg-white">
          <table className="pv-table w-full min-w-[860px] text-left text-sm">
            <thead className="bg-[#F6F2E7] text-[10.5px] font-bold uppercase tracking-[0.6px] text-[var(--pv-muted)]">
              <tr>
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Preferências</th>
                <th className="px-4 py-3">Admissão</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pv-line)]">
              {rows.map((c) => (
                <tr key={c.id} className={cn(c.status === 'inativo' && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.nome} size={34} />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[var(--pv-ink)]">{c.nome}</p>
                        <p className="text-[11px] font-medium text-[var(--pv-muted)]">{c.telefone || 'Sem telefone'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[var(--pv-ink)]">{c.cargo}</p>
                    {c.isGerente ? (
                      <span className="mt-0.5 inline-block rounded bg-[var(--pv-navy)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-[var(--pv-cream)]">
                        Gerente
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--pv-muted)]">
                    <p>
                      Turno: <span className="font-semibold text-[var(--pv-ink)]">{SHIFT_PREFERENCE_LABEL[c.turnoPreferido]}</span>
                    </p>
                    <p>
                      Folga:{' '}
                      <span className="font-semibold text-[var(--pv-ink)]">
                        {c.folgaPreferida === null ? 'tanto faz' : SCHEDULE_DAYS[c.folgaPreferida].long}
                      </span>
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="font-semibold text-[var(--pv-ink)]">{formatDateBR(c.admissao)}</p>
                    <p className="text-[var(--pv-muted)]">{tenureLabel(c.admissao)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold',
                        c.status === 'ativo'
                          ? 'bg-[var(--pv-success-bg)] text-[var(--pv-success)]'
                          : 'bg-[#EDE8DA] text-[var(--pv-muted)]',
                      )}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <IconAction label="Editar" onClick={() => openEdit(c)}>
                        <Pencil size={15} />
                      </IconAction>
                      <IconAction label={c.status === 'ativo' ? 'Inativar' : 'Reativar'} onClick={() => toggleStatus(c)}>
                        {c.status === 'ativo' ? <Power size={15} /> : <UserCheck size={15} />}
                      </IconAction>
                      <IconAction label="Excluir" danger onClick={() => setToDelete(c)}>
                        <Trash2 size={15} />
                      </IconAction>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--pv-muted)]">
                    Nenhum colaborador encontrado com esses filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[#A9A493]">
          Inativar mantém o histórico (faltas, ponto) e tira a pessoa das próximas escalas. Excluir apaga o cadastro.
        </p>
      </SectionCard>

      <CollaboratorFormModal
        open={formOpen}
        colaborador={editing}
        unitName={unitName}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir colaborador"
        confirmLabel="Excluir definitivamente"
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        description={
          <>
            Tem certeza que deseja excluir <strong>{toDelete?.nome}</strong>? O cadastro, o histórico no painel e a
            participação nas escalas serão removidos. Se a pessoa só saiu da empresa, prefira <strong>inativar</strong>.
          </>
        }
      />
    </div>
  )
}

function SummaryTile({ icon, label, value, color }: { icon: ReactNode; label: string; value: number; color: string }) {
  return (
    <article className="flex items-center gap-4 rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl">
      <span className="inline-flex rounded-xl bg-white p-3 shadow-sm" style={{ color }}>
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-muted)]">{label}</p>
        <p className="font-display text-3xl leading-none text-[var(--pv-ink)]">{value}</p>
      </div>
    </article>
  )
}

function IconAction({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'rounded-lg p-2 transition',
        danger
          ? 'text-[var(--pv-danger)] hover:bg-[var(--pv-danger-bg)]'
          : 'text-[var(--pv-muted)] hover:bg-[#F1EDE0] hover:text-[var(--pv-navy)]',
      )}
    >
      {children}
    </button>
  )
}
