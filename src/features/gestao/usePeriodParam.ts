import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PERIOD_OPTIONS } from './constants'
import type { PeriodKey } from './types'

const PARAM = 'periodo'
const DEFAULT_PERIOD: PeriodKey = '30d'

function isPeriodKey(value: string | null): value is PeriodKey {
  return PERIOD_OPTIONS.some((option) => option.value === value)
}

/** Período selecionado guardado na URL (?periodo=90d), validado contra as opções permitidas. */
export function usePeriodParam(): [PeriodKey, (period: PeriodKey) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get(PARAM)
  const period = isPeriodKey(raw) ? raw : DEFAULT_PERIOD

  const setPeriod = useCallback(
    (next: PeriodKey) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          if (next === DEFAULT_PERIOD) updated.delete(PARAM)
          else updated.set(PARAM, next)
          return updated
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return [period, setPeriod]
}
