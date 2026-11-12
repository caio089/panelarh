export const COMPETITION_UNIT_IDS = ['dirceu', 'promorar', 'mocambinho'] as const

export type CompetitionPeriod = 'dia' | 'mes'

export type CompetitionUnitMetric = {
  id: string
  name: string
  orders: number | null
  kitchenMinutes: number | null
}

export type CompetitionDayPoint = {
  date: string
  orders: number
  kitchenMinutes: number | null
}

type CompetitionResponse = {
  error?: string
  fetchedAt?: string
  unit?: CompetitionUnitMetric
  days?: CompetitionDayPoint[]
}

async function readJson<T>(response: Response): Promise<T> {
  const raw = await response.text()
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error('A consulta da TV não devolveu dados válidos.')
  }
}

/** Uma função por unidade. Quem chama decide a ordem e não dispara as três juntas. */
export async function fetchCompetitionUnit({
  unitId,
  date,
  period = 'dia',
  kitchen = false,
  daily = false,
  signal,
}: {
  unitId: string
  date?: string
  period?: CompetitionPeriod
  kitchen?: boolean
  daily?: boolean
  signal?: AbortSignal
}) {
  const params = new URLSearchParams({ unidade: unitId, periodo: period })
  if (date) params.set('dia', date)
  if (kitchen) params.set('dados', 'cozinha')
  if (daily) params.set('modo', 'diario')
  const timeout = new AbortController()
  const limit = daily || kitchen || period === 'mes' ? 60_000 : 20_000
  const timer = window.setTimeout(() => timeout.abort(), limit)
  const onAbort = () => timeout.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  let response: Response
  try {
    response = await fetch(`/api/competition?${params}`, { cache: 'no-store', signal: timeout.signal })
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
  const payload = await readJson<CompetitionResponse>(response)
  if (!response.ok || !payload.unit) {
    throw new Error(payload.error || 'Não foi possível atualizar a unidade.')
  }
  return payload
}

/** Percorre as unidades uma a uma. A primeira da lista aparece antes das outras. */
export async function loadCompetitionUnits({
  unitIds,
  date,
  period,
  kitchen = false,
  signal,
  onUnit,
}: {
  unitIds: readonly string[]
  date: string
  period: CompetitionPeriod
  kitchen?: boolean
  signal?: AbortSignal
  onUnit: (unit: CompetitionUnitMetric, fetchedAt?: string) => void
}) {
  const loaded: string[] = []
  let primaryError = ''
  for (const unitId of unitIds) {
    if (signal?.aborted) return { loaded, error: primaryError }
    try {
      const payload = await fetchCompetitionUnit({ unitId, date, period, kitchen, signal })
      if (!payload.unit) continue
      onUnit(payload.unit, payload.fetchedAt)
      loaded.push(unitId)
    } catch (error) {
      if (signal?.aborted) return { loaded, error: primaryError }
      if (!primaryError) primaryError = error instanceof Error ? error.message : 'Não foi possível atualizar a unidade.'
    }
  }
  return {
    loaded,
    error: loaded.includes(unitIds[0]) ? '' : primaryError || 'Não foi possível atualizar vendas e tempos.',
  }
}
