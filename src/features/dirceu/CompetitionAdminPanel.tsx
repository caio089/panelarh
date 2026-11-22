import { ExternalLink, RefreshCw, ShoppingBag, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { COMPETITION_UNIT_IDS, loadCompetitionUnits } from '@/features/dirceu/competitionClient'
import { competitionDayInFortaleza } from '@/features/dirceu/day'

const UNIT_DETAILS = {
  dirceu: { name: 'Dirceu', path: '/admin/unidade/unit-dirceu' },
  promorar: { name: 'Promorar', path: '/admin/unidade/unit-promorar' },
  mocambinho: { name: 'Mocambinho', path: '/admin/unidade/unit-mocambinho' },
}
const REFRESH_MS = 60_000
const RETRY_MS = 20_000

export function CompetitionAdminPanel() {
  const [date, setDate] = useState(() => competitionDayInFortaleza())
  const [snapshot, setSnapshot] = useState<{ date: string; orders: Record<string, number>; updatedAt?: string }>()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const appliedRefresh = useRef(0)

  useEffect(() => {
    const timer = window.setInterval(() => setDate(competitionDayInFortaleza()), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let fresh = refreshKey !== appliedRefresh.current
    let pollTimer: number | undefined
    appliedRefresh.current = refreshKey
    setLoading(true)
    setStatus('')

    async function load() {
      const refresh = fresh
      fresh = false
      const result = await loadCompetitionUnits({
        unitIds: COMPETITION_UNIT_IDS,
        date,
        period: 'dia',
        fresh: refresh,
        signal: controller.signal,
        onUnit: ({ id, orders }, fields, fetchedAt, stale) => {
          if (controller.signal.aborted || !fields.orders || orders === null) return
          setSnapshot((current) => {
            const previous = current?.date === date ? current : { date, orders: {} }
            if (stale && previous.orders[id] !== undefined) return previous
            const updatedAt = fetchedAt && (!previous.updatedAt || Date.parse(fetchedAt) > Date.parse(previous.updatedAt))
              ? fetchedAt
              : previous.updatedAt
            return { date, orders: { ...previous.orders, [id]: orders }, updatedAt }
          })
        },
      })
      if (controller.signal.aborted) return
      setLoading(false)
      if (result.error) setStatus('Uma ou mais unidades estão indisponíveis. Últimos dados do turno em exibição, quando disponíveis.')
      else if (result.stale) setStatus('Atualização em andamento. Últimos dados do turno em exibição.')
      else if (result.pending) setStatus('Aguardando os totais do turno.')
      else setStatus('')
      const delay = result.stale || result.pending ? RETRY_MS : REFRESH_MS
      pollTimer = window.setTimeout(() => { void load() }, delay)
    }

    void load()
    return () => {
      controller.abort()
      if (pollTimer !== undefined) window.clearTimeout(pollTimer)
    }
  }, [date, refreshKey])

  const current = snapshot?.date === date ? snapshot : undefined
  const updatedAt = current?.updatedAt
    ? new Date(current.updatedAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit' })
    : ''
  const ranking = COMPETITION_UNIT_IDS.map((id) => ({
    id,
    ...UNIT_DETAILS[id],
    orders: current?.orders[id] ?? null,
  })).sort((a, b) => (b.orders ?? -1) - (a.orders ?? -1) || a.name.localeCompare(b.name))
  const complete = ranking.every((unit) => unit.orders !== null)

  return (
    <section className="overflow-hidden rounded-[28px] bg-[#0A1228] text-[#F7F4EC] shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1.6px] text-[#F4B942]"><Trophy size={13} /> Operação Saipos</p>
          <h2 className="mt-1 font-display text-3xl">Comparativo entre unidades</h2>
          <p className="mt-1 text-sm text-white/65">Mesa e delivery por unidade, sem balcão, ficha ou cancelados. Clique para abrir o detalhamento de cada casa.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50">Turno {date.split('-').reverse().join('/')}{updatedAt ? ` · Atualizado às ${updatedAt}` : ''}</span>
          <Button type="button" variant="outline" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </Button>
        </div>
      </header>

      {(loading || status) ? <p role="status" className="mx-5 mt-5 rounded-xl bg-[#7A2F2F]/35 px-4 py-3 text-sm sm:mx-7">{loading ? 'Consultando vendas do turno…' : status}</p> : null}
      <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-7">
        {ranking.map((unit) => (
          <Link
            key={unit.id}
            to={unit.path}
            className="group rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-2xl">{unit.name}</p>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-[#F4B942]">{complete ? `#${ranking.findIndex((item) => item.orders === unit.orders) + 1}` : '—'}</span>
            </div>
            <p className="mt-4 inline-flex items-center gap-1.5 font-display text-2xl text-[#F4B942]"><ShoppingBag size={18} /> {unit.orders === null ? '—' : `${unit.orders} vendas`}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#EFE3C4]">Abrir operação da unidade <ExternalLink size={13} className="transition group-hover:translate-x-0.5" /></p>
          </Link>
        ))}
      </div>
    </section>
  )
}
