import { OCCURRENCE_META, OCCURRENCE_TYPES } from '../constants'
import type { CollaboratorStats } from '../metrics'
import { Avatar, RiskBadge } from './atoms'

/** Lista compacta dos colaboradores com maior score de risco. */
export function WatchList({
  items,
  unitNameById,
  onSelect,
}: {
  items: CollaboratorStats[]
  unitNameById: Map<string, string>
  onSelect: (stats: CollaboratorStats) => void
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--pv-muted)]">Nenhum colaborador em atenção no período.</p>
  }

  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.colaborador.id}>
          <button
            type="button"
            onClick={() => onSelect(s)}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--pv-line)] bg-white px-3 py-2.5 text-left transition hover:border-[var(--pv-terracotta)]/40 hover:shadow-md"
          >
            <Avatar name={s.colaborador.nome} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[var(--pv-ink)]">{s.colaborador.nome}</p>
              <p className="truncate text-[11px] font-medium text-[var(--pv-muted)]">
                {s.colaborador.cargo} · {unitNameById.get(s.colaborador.unitId)}
              </p>
            </div>
            <div className="hidden gap-1 sm:flex">
              {OCCURRENCE_TYPES.filter((t) => s.occurrences[t] > 0).map((t) => (
                <span
                  key={t}
                  title={OCCURRENCE_META[t].plural}
                  className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                  style={{ background: OCCURRENCE_META[t].bg, color: OCCURRENCE_META[t].color }}
                >
                  {s.occurrences[t]} {OCCURRENCE_META[t].label.slice(0, 3).toLowerCase()}
                </span>
              ))}
            </div>
            <RiskBadge level={s.riskLevel} />
          </button>
        </li>
      ))}
    </ul>
  )
}
