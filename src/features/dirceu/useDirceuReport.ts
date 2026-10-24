import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isDirceuPeriod, isIsoDate, periodBounds, todayInFortaleza, type DirceuPeriod } from './day'
import { isDirceuCategory, type DirceuCategory, type DirceuPayload } from './types'

const DAY = 'dia'
const CATEGORY = 'cat'
const PERIOD = 'periodo'
const REFRESH_MS = 10 * 60 * 1000

/** Prefixo evita colidir com o `periodo` do RH na página da unidade. */
function paramName(prefix: string, name: string) {
  return prefix ? `${prefix}_${name}` : name
}

export function useDirceuReport(paramPrefix = '', unit = 'dirceu') {
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
      setData(null)
      setError('')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    let cancelled = false
    const fresh = requestFresh.current
    requestFresh.current = false
    setLoading(true)
    setError('')
    setData((current) => {
      if (fresh && current?.category === category && current.period === period && current.date === day) return current
      return null
    })

    async function load(selected: DirceuCategory) {
      let lastMessage = 'Não foi possível carregar este relatório.'
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (cancelled) return
        let sawReport = false
        try {
          const refresh = fresh ? '&atualiza=1' : ''
          const response = await fetch(`/api/saipos?unidade=${unit}&dia=${day}&categoria=${selected}&periodo=${period}${refresh}`, {
            signal: controller.signal,
          })
          if (!response.ok || !response.body) {
            const failed = (await response.json().catch(() => ({}))) as { error?: string }
            throw new Error(failed.error || lastMessage)
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
          if (!cancelled && !sawReport) throw new Error(lastMessage)
          if (!cancelled) setLoading(false)
          return
        } catch (reason: unknown) {
          if (reason instanceof DOMException && reason.name === 'AbortError') return
          lastMessage = reason instanceof Error ? reason.message : lastMessage
          if (sawReport) {
            if (!cancelled) {
              setLoading(false)
              setError(lastMessage)
            }
            return
          }
          if (attempt < 1) await new Promise((resolve) => setTimeout(resolve, 1200))
        }
      }
      if (!cancelled) {
        if (!fresh) setData(null)
        setError(lastMessage)
      }
    }

    void load(category).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [day, period, category, reloadKey, unit])

  useEffect(() => {
    if (!category || period !== 'dia') return
    const timer = window.setInterval(() => {
      requestFresh.current = true
      setReloadKey((value) => value + 1)
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [category, period])

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
