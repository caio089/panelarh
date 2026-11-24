import { useCallback, useEffect, useRef, useState } from 'react'
import { usePageVisible } from './usePageVisible'
import { useSearchParams } from 'react-router-dom'
import { isDirceuPeriod, isIsoDate, periodBounds, todayInFortaleza, type DirceuPeriod } from './day'
import { isDirceuCategory, type DirceuCategory, type DirceuPayload } from './types'

const DAY = 'dia'
const CATEGORY = 'cat'
const PERIOD = 'periodo'

/** Prefixo evita colidir com o `periodo` do RH na página da unidade. */
function paramName(prefix: string, name: string) {
  return prefix ? `${prefix}_${name}` : name
}

export function useDirceuReport(paramPrefix = '', unit = 'dirceu') {
  const visible = usePageVisible()
  const dayKey = paramName(paramPrefix, DAY)
  const categoryKey = paramName(paramPrefix, CATEGORY)
  const periodKey = paramName(paramPrefix, PERIOD)
  const [params, setParams] = useSearchParams()
  const rawDay = params.get(dayKey)
  const rawCategory = params.get(categoryKey)
  const rawPeriod = params.get(periodKey)
  const day = isIsoDate(rawDay) ? rawDay : todayInFortaleza()
  const period: DirceuPeriod = isDirceuPeriod(rawPeriod) ? rawPeriod : 'dia'
  const category = isDirceuCategory(rawCategory) ? rawCategory : null
  const bounds = periodBounds(day, period)
  const [data, setData] = useState<DirceuPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const requestFresh = useRef(false)
  const completed = useRef('')

  const setDay = useCallback(
    (next: string) => {
      if (!isIsoDate(next)) return
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          updated.set(dayKey, next)
          return updated
        },
        { replace: true },
      )
    },
    [dayKey, setParams],
  )

  const setPeriod = useCallback(
    (next: DirceuPeriod) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          updated.set(dayKey, day)
          updated.set(periodKey, next)
          return updated
        },
        { replace: true },
      )
    },
    [day, dayKey, periodKey, setParams],
  )

  const setCategory = useCallback(
    (next: DirceuCategory) => {
      setParams(
        (prev) => {
          const updated = new URLSearchParams(prev)
          updated.set(dayKey, day)
          updated.set(categoryKey, next)
          return updated
        },
        { replace: true },
      )
    },
    [categoryKey, day, dayKey, setParams],
  )

  useEffect(() => {
    if (isIsoDate(rawDay)) return
    setDay(todayInFortaleza())
  }, [rawDay, setDay])

  useEffect(() => {
    if (!category) {
      completed.current = ''
      setData(null)
      setError('')
      setLoading(false)
      return
    }

    const key = [unit, day, period, category, reloadKey].join(':')
    if (!visible || completed.current === key) return
    completed.current = ''
    const controller = new AbortController()
    let cancelled = false
    const fresh = requestFresh.current
    setLoading(true)
    setError('')
    setData((current) => {
      if (fresh && current?.category === category && current.period === period && current.date === day) return current
      return null
    })

    async function load(selected: DirceuCategory) {
      requestFresh.current = false
      let sawReport = false
      try {
        const refresh = fresh ? '&atualiza=1' : ''
        const response = await fetch(`/api/saipos?unidade=${unit}&dia=${day}&categoria=${selected}&periodo=${period}${refresh}`, {
          signal: controller.signal,
        })
        if (!response.ok || !response.body) {
          const failed = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(failed.error || 'Não foi possível carregar este relatório.')
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!cancelled) {
          const { done, value } = await reader.read()
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            const payload = JSON.parse(line) as DirceuPayload & { error?: string }
            if (payload.error && !payload.report) throw new Error(payload.error)
            if (payload.report) {
              sawReport = true
              setData(payload)
              setLoading(payload.partial !== false)
            }
            if (payload.error) setError(payload.error)
          }
          if (done) break
        }
        if (!cancelled && !sawReport) throw new Error('Não foi possível carregar este relatório.')
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar este relatório.')
      } finally {
        if (!cancelled) {
          completed.current = key
          setLoading(false)
        }
      }
    }

    const timer = window.setTimeout(() => { void load(category) }, 0)
    return () => {
      window.clearTimeout(timer)
      cancelled = true
      controller.abort()
    }
  }, [day, period, category, reloadKey, unit, visible])

  return {
    day,
    setDay,
    period,
    setPeriod,
    bounds,
    category,
    setCategory,
    data,
    error,
    loading,
    retry: () => {
      requestFresh.current = true
      setReloadKey((value) => value + 1)
    },
  }
}
