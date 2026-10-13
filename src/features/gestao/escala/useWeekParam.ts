import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getWeekStart, isValidWeekStart } from './week'

const PARAM = 'semana'

/** Semana selecionada guardada na URL (?semana=yyyy-mm-dd, sempre uma segunda-feira). */
export function useWeekParam(): [string, (weekStart: string) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get(PARAM)
  const current = getWeekStart()
  const weekStart = isValidWeekStart(raw) ? raw : current

  const setWeek = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          if (next === current) updated.delete(PARAM)
          else updated.set(PARAM, next)
          return updated
        },
        { replace: true },
      )
    },
    [setParams, current],
  )

  return [weekStart, setWeek]
}
