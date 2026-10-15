import { useMemo, useState } from 'react'
import { ArrowDownUp, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OCCURRENCE_META, OCCURRENCE_TYPES } from '../constants'
import { totalOccurrences, type CollaboratorStats } from '../metrics'
import type { OccurrenceType } from '../types'
import { Avatar, RiskBadge } from './atoms'

type SortKey = 'risk' | OccurrenceType
type TypeFilter = 'todos' | OccurrenceType

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'risk', label: 'Risco' },
  ...OCCURRENCE_TYPES.map((t) => ({ value: t, label: OCCURRENCE_META[t].plural })),
]

function sortStats(list: CollaboratorStats[], key: SortKey): CollaboratorStats[] {
  return [...list].sort((a, b) => {
    if (key === 'risk') return b.riskScore - a.riskScore
    return b.occurrences[key] - a.occurrences[key]
  })
}

/** Tabela por colaborador com busca, filtro por tipo de ocorrência e ordenação. */
export function CollaboratorTable({
  stats,
  onSelect,
}: {
  stats: CollaboratorStats[]
  onSelect: (stats: CollaboratorStats) => void
}) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos')
  const [sortKey, setSortKey] = useState<SortKey>('risk')

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = stats.filter((s) => {
      const matchesQuery =
        !normalizedQuery ||
        s.colaborador.nome.toLowerCase().includes(normalizedQuery) ||
        s.colaborador.cargo.toLowerCase().includes(normalizedQuery)
      const matchesType = typeFilter === 'todos' || s.occurrences[typeFilter] > 0
      return matchesQuery && matchesType
    })
    return sortStats(filtered, typeFilter === 'todos' ? sortKey : typeFilter)
  }, [stats, query, typeFilter, sortKey])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChip active={typeFilter === 'todos'} onClick={() => setTypeFilter('todos')} label="Todos" count={stats.length} />
        {OCCURRENCE_TYPES.map((t) => (
          <FilterChip
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
            label={OCCURRENCE_META[t].plural}
            count={stats.filter((s) => s.occurrences[t] > 0).length}
            color={OCCURRENCE_META[t].color}
          />
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9A493]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar colaborador ou cargo"
              maxLength={60}
              className="w-56 rounded-xl border border-[var(--pv-line-strong)] bg-white py-2 pl-8 pr-3 text-xs text-[var(--pv-ink)] outline-none focus:border-[var(--pv-terracotta)]"
            />
          </label>
          <label className="flex items-center gap-1.5 rounded-xl border border-[var(--pv-line-strong)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--pv-muted)]">
            <ArrowDownUp size={13} />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-transparent text-[var(--pv-ink)] outline-none"
              aria-label="Ordenar por"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="pv-scroll overflow-x-auto rounded-xl border border-[var(--pv-line)] bg-white">
        <table className="pv-table w-full min-w-[780px] text-left text-sm">
          <thead className="bg-[#F6F2E7] text-[10.5px] font-bold uppercase tracking-[0.6px] text-[var(--pv-muted)]">
            <tr>
              <th className="px-4 py-3">Colaborador</th>
              {OCCURRENCE_TYPES.map((t) => (
                <th key={t} className="px-2 py-3 text-center">
                  {OCCURRENCE_META[t].plural}
                </th>
              ))}
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--pv-line)]">
            {rows.map((s) => (
              <tr key={s.colaborador.id} className="cursor-pointer" onClick={() => onSelect(s)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.colaborador.nome} size={32} />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[var(--pv-ink)]">
                        {s.colaborador.nome}
                        {s.colaborador.isGerente ? (
                          <span className="ml-1.5 rounded bg-[var(--pv-navy)] px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-[var(--pv-cream)]">
                            Gerente
                          </span>
                        ) : null}
                        {s.colaborador.status === 'inativo' ? (
                          <span className="ml-1.5 rounded bg-[#EDE8DA] px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-[var(--pv-muted)]">
                            Inativo
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] font-medium text-[var(--pv-muted)]">{s.colaborador.cargo}</p>
                    </div>
                  </div>
                </td>
                {OCCURRENCE_TYPES.map((t) => (
                  <td key={t} className="px-2 py-3 text-center">
                    <CountCell value={s.occurrences[t]} color={OCCURRENCE_META[t].color} bg={OCCURRENCE_META[t].bg} />
                  </td>
                ))}
                <td className="px-4 py-3">
                  <RiskBadge level={s.riskLevel} />
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--pv-muted)]">
                  Nenhum colaborador encontrado com esses filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-[#A9A493]">
        {rows.length} colaboradores · {rows.reduce((sum, r) => sum + totalOccurrences(r.occurrences), 0)} ocorrências ·
        clique em uma linha para ver a ficha
      </p>
    </div>
  )
}

function CountCell({ value, color, bg }: { value: number; color: string; bg: string }) {
  if (value === 0) return <span className="text-[#C7C0AA]">–</span>
  return (
    <span className="inline-flex min-w-7 justify-center rounded-md px-1.5 py-0.5 font-display text-sm" style={{ color, background: bg }}>
      {value}
    </span>
  )
}

function FilterChip({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  color?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition',
        active
          ? 'border-[var(--pv-navy)] bg-[var(--pv-navy)] text-white'
          : 'border-[var(--pv-line-strong)] bg-white text-[var(--pv-muted)] hover:border-[var(--pv-navy)]/40',
      )}
    >
      {color ? <span className="h-2 w-2 rounded-full" style={{ background: color }} /> : null}
      {label}
      <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-white/20' : 'bg-[#F1EDE0]')}>{count}</span>
    </button>
  )
}
