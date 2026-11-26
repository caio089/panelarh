import { Clock3, ExternalLink, RefreshCw, ShoppingBag, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { usePageVisible } from './usePageVisible'
import { COMPETITION_UNIT_IDS, fetchCompetitionUnit } from '@/features/dirceu/competitionClient'
import { competitionDayInFortaleza, formatRangeLabel, shiftIsoDate } from '@/features/dirceu/day'

type UnitResult = {
  id: string
  name: string
  path: string
  orders: number | null
  kitchenMinutes: number | null
  salesDays: number
  kitchenDays: number
  totalDays: number
  stale: boolean
}

const UNIT_DETAILS = {
  dirceu: { name: 'Dirceu', path: '/admin/unidade/unit-dirceu' },
  promorar: { name: 'Promorar', path: '/admin/unidade/unit-promorar' },
  mocambinho: { name: 'Mocambinho', path: '/admin/unidade/unit-mocambinho' },
}

export function CompetitionAdminPanel({ from, to, presetDays, refreshKey = 0 }: { from: string; to: string; presetDays?: 7 | 30 | 90; refreshKey?: number }) {
  const visible = usePageVisible()
  const [latestShift, setLatestShift] = useState(() => competitionDayInFortaleza())
  const [snapshot, setSnapshot] = useState<{ key: string; units: Record<string, UnitResult>; updatedAt?: string }>()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [localRefresh, setLocalRefresh] = useState(0)
  const appliedRefresh = useRef('0:0')
  const end = to < latestShift ? to : latestShift
  const start = presetDays ? shiftIsoDate(end, 1 - presetDays) : from
  const key = `${start}:${end}:${refreshKey}:${localRefresh}`

  useEffect(() => {
    if (!visible) return
    const timer = window.setInterval(() => setLatestShift(competitionDayInFortaleza()), 60_000)
    return () => window.clearInterval(timer)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      if (start > end) {
        setSnapshot({ key, units: {} })
        setLoading(false)
        setStatus('Ainda não há turno concluído neste intervalo.')
        return
      }
      setSnapshot({ key, units: {} })
      setLoading(true)
      setStatus('')
      const refreshToken = `${refreshKey}:${localRefresh}`
      const fresh = refreshToken !== appliedRefresh.current
      appliedRefresh.current = refreshToken
      void (async () => {
        let failed = 0
        let partial = 0
        let stale = 0
        for (const id of COMPETITION_UNIT_IDS) {
          if (controller.signal.aborted) return
          try {
            const payload = await fetchCompetitionUnit({ unitId: id, period: 'intervalo', start, end, fresh, signal: controller.signal })
            if (controller.signal.aborted) return
            const coverage = payload.coverage
            const result: UnitResult = {
              id, ...UNIT_DETAILS[id],
              orders: payload.unit.orders ?? payload.observedOrders ?? null,
              kitchenMinutes: payload.unit.kitchenMinutes ?? payload.observedKitchenMinutes ?? null,
              salesDays: coverage?.salesDays ?? 0,
              kitchenDays: coverage?.kitchenDays ?? 0,
              totalDays: coverage?.totalDays ?? 0,
              stale: Boolean(payload.stale),
            }
            if (payload.partial) partial += 1
            if (result.stale) stale += 1
            setSnapshot((current) => current?.key === key ? {
              ...current,
              units: { ...current.units, [id]: result },
              updatedAt: payload.fetchedAt && (!current.updatedAt || Date.parse(payload.fetchedAt) > Date.parse(current.updatedAt)) ? payload.fetchedAt : current.updatedAt,
            } : current)
          } catch {
            if (controller.signal.aborted) return
            failed += 1
          }
        }
        if (controller.signal.aborted) return
        setLoading(false)
        if (failed) setStatus('Uma ou mais unidades estão indisponíveis. Atualize para tentar novamente.')
        else if (partial) setStatus('Histórico da Saipos ainda em preenchimento. Os números exibidos consideram apenas os dias com dados; a cobertura aparece em cada unidade.')
        else if (stale) setStatus('Últimos dados disponíveis em exibição. Atualize para consultar novamente.')
        else setStatus('')
      })()
    }, 0)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [visible, start, end, key, localRefresh, refreshKey])

  const current = snapshot?.key === key ? snapshot : undefined
  const ranking = COMPETITION_UNIT_IDS.map((id) => current?.units[id] ?? { id, ...UNIT_DETAILS[id], orders: null, kitchenMinutes: null, salesDays: 0, kitchenDays: 0, totalDays: 0, stale: false })
    .sort((a, b) => (b.orders ?? -1) - (a.orders ?? -1) || a.name.localeCompare(b.name))
  const complete = ranking.every((unit) => unit.totalDays > 0 && unit.salesDays === unit.totalDays)
  const updatedAt = current?.updatedAt ? new Date(current.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }) : ''

  return <section className="overflow-hidden rounded-[28px] bg-[#0A1228] text-[#F7F4EC] shadow-xl">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
      <div><p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1.6px] text-[#F4B942]"><Trophy size={13} /> Operação Saipos</p>
        <h2 className="mt-1 font-display text-2xl sm:text-3xl">Comparativo entre unidades</h2>
        <p className="mt-1 text-sm text-white/65">Vendas sem canceladas e tempo médio de preparo na cozinha.</p>
        <p className="mt-2 text-xs font-semibold text-[#F4B942]">{start <= end ? formatRangeLabel(start, end) : 'Aguardando turno concluído'}{end !== to ? ' · Até o último turno concluído' : ''}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3"><span className="text-xs text-white/50">{updatedAt ? `Dados atualizados em ${updatedAt}` : 'Consultando Saipos'}</span>
        <button type="button" onClick={() => setLocalRefresh((value) => value + 1)} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar</button>
      </div>
    </header>
    {loading || status ? <p role="status" className="mx-5 mt-5 rounded-xl bg-[#7A2F2F]/35 px-4 py-3 text-sm sm:mx-7">{loading ? 'Consultando o intervalo nas três unidades…' : status}</p> : null}
    <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-7">{ranking.map((unit) => <Link key={unit.id} to={unit.path} className="group min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.1]">
      <div className="flex items-center justify-between gap-2"><p className="truncate font-display text-xl sm:text-2xl">{unit.name}</p><span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-[#F4B942]">{complete ? `#${ranking.findIndex((item) => item.orders === unit.orders) + 1}` : '—'}</span></div>
      <p className="mt-4 inline-flex items-center gap-1.5 font-display text-2xl text-[#F4B942]"><ShoppingBag size={18} /> {unit.orders === null ? '—' : `${unit.orders.toLocaleString('pt-BR')} vendas`}</p>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-white/80"><Clock3 size={16} /> Preparo médio: <strong>{unit.kitchenMinutes === null ? '—' : `${unit.kitchenMinutes.toLocaleString('pt-BR')} min`}</strong></p>
      {unit.totalDays > 0 ? <p className="mt-3 text-xs text-white/50">Vendas: {unit.salesDays}/{unit.totalDays} dias · Cozinha: {unit.kitchenDays}/{unit.totalDays} dias</p> : null}
      <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#EFE3C4]">Abrir operação da unidade <ExternalLink size={13} className="transition group-hover:translate-x-0.5" /></p>
    </Link>)}</div>
  </section>
}
