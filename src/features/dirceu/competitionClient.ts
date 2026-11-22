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
  date?: string
  period?: CompetitionPeriod
  error?: string
  fetchedAt?: string
  partial?: boolean
  stale?: boolean
  coverage?: { totalDays: number; salesDays: number; kitchenDays: number }
  unit?: CompetitionUnitMetric
  days?: CompetitionDayPoint[]
}

export type CompetitionFields = { orders: boolean; kitchen: boolean }

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
  fresh = false,
  signal,
}: {
  unitId: string
  date?: string
  period?: CompetitionPeriod
  kitchen?: boolean
  daily?: boolean
  fresh?: boolean
  signal?: AbortSignal
}) {
  const params = new URLSearchParams({ unidade: unitId, periodo: period })
  if (date) params.set('dia', date)
  if (kitchen) params.set('dados', 'cozinha')
  if (daily) params.set('modo', 'diario')
  if (fresh) params.set('atualiza', '1')
  const response = await fetch(`/api/competition?${params}`, { cache: 'no-store', signal })
  const payload = await readJson<CompetitionResponse>(response)
  if (!response.ok || !payload.unit) {
    throw new Error(payload.error || 'Não foi possível atualizar a unidade.')
  }
  if ((date && payload.date && payload.date !== date) || (payload.period && payload.period !== period) || payload.unit.id !== unitId) {
    throw new Error('A resposta da competição veio com outro período ou unidade.')
  }
  const { coverage } = payload
  const validCoverage = coverage && coverage.totalDays > 0
  const salesComplete = validCoverage ? coverage.salesDays === coverage.totalDays : !payload.partial
  const kitchenComplete = validCoverage ? coverage.kitchenDays === coverage.totalDays : !payload.partial
  const fields = {
    orders: !kitchen && salesComplete && Number.isFinite(payload.unit.orders),
    kitchen: (kitchen || period === 'mes') && kitchenComplete,
  }
  const unit = {
    ...payload.unit,
    orders: fields.orders ? payload.unit.orders : null,
    kitchenMinutes: fields.kitchen && Number.isFinite(payload.unit.kitchenMinutes) ? payload.unit.kitchenMinutes : null,
  }
  return { ...payload, unit, fields }
}

/** Percorre as unidades uma a uma. A primeira da lista aparece antes das outras. */
export async function loadCompetitionUnits({
  unitIds,
  date,
  period,
  kitchen = false,
  fresh = false,
  signal,
  onUnit,
}: {
  unitIds: readonly string[]
  date: string
  period: CompetitionPeriod
  kitchen?: boolean
  fresh?: boolean
  signal?: AbortSignal
  onUnit: (unit: CompetitionUnitMetric, fields: CompetitionFields, fetchedAt?: string, stale?: boolean) => void
}) {
  const loaded: string[] = []
  let primaryError = ''
  let pending = false
  let stale = false
  for (const unitId of unitIds) {
    if (signal?.aborted) break
    try {
      const payload = await fetchCompetitionUnit({ unitId, date, period, kitchen, fresh, signal })
      const { fields } = payload
      const complete = period === 'mes' && !kitchen
        ? fields.orders && fields.kitchen
        : kitchen ? fields.kitchen : fields.orders
      pending ||= Boolean(payload.partial) || !complete
      stale ||= Boolean(payload.stale)
      primaryError ||= payload.error || ''
      if (fields.kitchen || fields.orders) onUnit(payload.unit, fields, payload.fetchedAt, payload.stale)
      if (complete) loaded.push(unitId)
    } catch (error) {
      if (signal?.aborted) break
      if (!primaryError) primaryError = error instanceof Error ? error.message : 'Não foi possível atualizar a unidade.'
    }
  }
  return {
    loaded,
    pending,
    stale,
    error: primaryError,
  }
}
