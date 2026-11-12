import { closestCorners, pointerWithin, type CollisionDetection } from '@dnd-kit/core'
import { PIPELINE_ORDER, type CandidateStatus } from '@/types'

const COLUMNS = new Set<string>(PIPELINE_ORDER)

/** Prefere a coluna sob o ponteiro. Sem isso o cartão cola na coluna de origem. */
export const detectPipelineDrop: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  const overColumn = pointerHits.find((hit) => COLUMNS.has(String(hit.id)))
  if (overColumn) return [overColumn]
  if (pointerHits.length > 0) return pointerHits
  const corners = closestCorners(args)
  const column = corners.find((hit) => COLUMNS.has(String(hit.id)))
  return column ? [column] : corners
}

export function statusFromDrop(
  overId: string,
  statusOfCard: (id: string) => CandidateStatus | undefined,
): CandidateStatus | null {
  if (COLUMNS.has(overId)) return overId as CandidateStatus
  return statusOfCard(overId) ?? null
}
