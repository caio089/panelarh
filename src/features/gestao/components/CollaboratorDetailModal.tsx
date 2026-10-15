import { Modal } from '@/components/ui'
import { OCCURRENCE_META, OCCURRENCE_TYPES } from '../constants'
import { formatShortDate } from '../dateUtils'
import { filterByRange, type CollaboratorStats, type DateRange } from '../metrics'
import type { GestaoDataset } from '../types'
import { Avatar, RiskBadge } from './atoms'

interface CollaboratorDetailModalProps {
  stats: CollaboratorStats | null
  dataset: GestaoDataset
  range: DateRange
  unitName?: string
  onClose: () => void
}

/** Ficha do colaborador: ocorrências do período. */
export function CollaboratorDetailModal({ stats, dataset, range, unitName, onClose }: CollaboratorDetailModalProps) {
  if (!stats) return null
  const { colaborador } = stats

  const occurrences = filterByRange(
    dataset.ocorrencias.filter((o) => o.colaboradorId === colaborador.id),
    range,
  ).sort((a, b) => b.data.localeCompare(a.data))

  return (
    <Modal open title="Ficha do colaborador" onClose={onClose} wide>
      <div className="flex items-center gap-3">
        <Avatar name={colaborador.nome} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg text-[var(--pv-ink)]">{colaborador.nome}</p>
          <p className="text-xs font-medium text-[var(--pv-muted)]">
            {colaborador.cargo}
            {unitName ? ` · ${unitName}` : ''} · entrada {colaborador.entradaPrevista}
          </p>
        </div>
        <RiskBadge level={stats.riskLevel} />
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {OCCURRENCE_TYPES.map((t) => (
          <div key={t} className="rounded-xl px-2 py-3 text-center" style={{ background: OCCURRENCE_META[t].bg }}>
            <p className="font-display text-2xl leading-none" style={{ color: OCCURRENCE_META[t].color }}>
              {stats.occurrences[t]}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase text-[var(--pv-muted)]">{OCCURRENCE_META[t].short}</p>
          </div>
        ))}
      </div>

      <h4 className="mt-6 text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-muted)]">Histórico no período</h4>
      {occurrences.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-[var(--pv-line-strong)] px-4 py-5 text-center text-sm text-[var(--pv-muted)]">
          Nenhuma ocorrência registrada no período.
        </p>
      ) : (
        <ol className="relative mt-3 space-y-3 border-l-2 border-[var(--pv-line)] pl-4">
          {occurrences.map((oc) => (
            <li key={oc.id} className="relative">
              <span
                className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--pv-surface)]"
                style={{ background: OCCURRENCE_META[oc.tipo].color }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-md px-2 py-0.5 text-[10.5px] font-bold"
                  style={{ background: OCCURRENCE_META[oc.tipo].bg, color: OCCURRENCE_META[oc.tipo].color }}
                >
                  {OCCURRENCE_META[oc.tipo].label}
                </span>
                <span className="text-xs font-semibold text-[var(--pv-muted)]">{formatShortDate(oc.data)}</span>
                {oc.dias > 1 ? <span className="text-xs text-[#A9A493]">· {oc.dias} dias</span> : null}
              </div>
              <p className="mt-0.5 text-sm text-[var(--pv-ink)]">{oc.motivo}</p>
            </li>
          ))}
        </ol>
      )}

    </Modal>
  )
}
