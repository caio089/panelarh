import { Clock3, ExternalLink, RefreshCw, ShoppingBag, Trophy, Wifi } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui'
import { competitionDayInFortaleza } from '@/features/dirceu/day'

type CompetitionUnit = {
  id: 'dirceu' | 'promorar' | 'mocambinho'
  name: string
  orders: number
  kitchenMinutes: number | null
}

type CompetitionPayload = {
  error?: string
  fetchedAt?: string
  units?: CompetitionUnit[]
}

type RankedUnit = CompetitionUnit & {
  salesPoints: number
  kitchenPoints: number
  totalPoints: number
}

const REFRESH_MS = 60 * 1000
const UNIT_PATHS: Record<CompetitionUnit['id'], string> = {
  dirceu: '/admin/unidade/unit-dirceu',
  promorar: '/admin/unidade/unit-promorar',
  mocambinho: '/admin/unidade/unit-mocambinho',
}
const EMPTY_UNITS: CompetitionUnit[] = [
  { id: 'dirceu', name: 'Dirceu', orders: 0, kitchenMinutes: null },
  { id: 'promorar', name: 'Promorar', orders: 0, kitchenMinutes: null },
  { id: 'mocambinho', name: 'Mocambinho', orders: 0, kitchenMinutes: null },
]

function pointsForPosition(position: number) {
  if (position === 1) return 3
  if (position === 2) return 2
  return 0
}

function rankingPosition<T>(items: T[], index: number, valueOf: (item: T) => number) {
  const current = valueOf(items[index])
  return items.findIndex((item) => valueOf(item) === current) + 1
}

function buildRanking(units: CompetitionUnit[]): RankedUnit[] {
  const sales = [...units].sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name))
  const kitchen = [...units].sort((a, b) => (a.kitchenMinutes ?? Infinity) - (b.kitchenMinutes ?? Infinity) || a.name.localeCompare(b.name))

  return units.map((unit) => {
    const salesIndex = sales.findIndex((item) => item.id === unit.id)
    const kitchenIndex = kitchen.findIndex((item) => item.id === unit.id)
    const salesPosition = rankingPosition(sales, salesIndex, (item) => item.orders)
    const kitchenPosition = typeof unit.kitchenMinutes === 'number'
      ? rankingPosition(kitchen, kitchenIndex, (item) => -(item.kitchenMinutes ?? Infinity))
      : 0
    const salesPoints = pointsForPosition(salesPosition)
    const kitchenPoints = pointsForPosition(kitchenPosition)
    return { ...unit, salesPoints, kitchenPoints, totalPoints: salesPoints + kitchenPoints }
  }).sort((a, b) => b.totalPoints - a.totalPoints || b.salesPoints - a.salesPoints || a.name.localeCompare(b.name))
}

export function CompetitionAdminPanel() {
  const date = competitionDayInFortaleza()
  const [units, setUnits] = useState<CompetitionUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load(forceRefresh = false) {
      if (forceRefresh) setLoading(true)
      const refresh = forceRefresh ? '&atualiza=1' : ''
      try {
        const [salesResult, kitchenResult] = await Promise.allSettled([
          fetch(`/api/competition?dia=${date}&periodo=dia${refresh}`, { signal: controller.signal, cache: 'no-store' }),
          fetch(`/api/competition?dia=${date}&periodo=dia&dados=cozinha${refresh}`, { signal: controller.signal, cache: 'no-store' }),
        ])

        if (salesResult.status !== 'fulfilled') throw salesResult.reason
        const salesPayload = (await salesResult.value.json()) as CompetitionPayload
        if (!salesResult.value.ok || !salesPayload.units) throw new Error(salesPayload.error || 'Não foi possível atualizar o ranking.')

        let kitchenPayload: CompetitionPayload | null = null
        if (kitchenResult.status === 'fulfilled') {
          kitchenPayload = (await kitchenResult.value.json()) as CompetitionPayload
          if (!kitchenResult.value.ok) kitchenPayload = null
        }
        const kitchenById = new Map(kitchenPayload?.units?.map((unit) => [unit.id, unit.kitchenMinutes]) ?? [])

        setUnits((current) => salesPayload.units!.map((unit) => {
          const freshKitchen = kitchenById.get(unit.id)
          const lastKitchen = current.find((item) => item.id === unit.id)?.kitchenMinutes ?? null
          return {
            ...unit,
            kitchenMinutes: typeof freshKitchen === 'number' ? freshKitchen : lastKitchen,
          }
        }))
        const fetchedAt = kitchenPayload?.fetchedAt || salesPayload.fetchedAt
        setUpdatedAt(fetchedAt ? new Date(fetchedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
        setError(kitchenPayload ? '' : 'Tempo da cozinha em nova tentativa; vendas atualizadas.')
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o ranking.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load(refreshKey > 0)
    const interval = window.setInterval(() => { void load() }, REFRESH_MS)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [date, refreshKey])

  const visibleUnits = units.length ? units : EMPTY_UNITS
  const ranking = useMemo(() => buildRanking(visibleUnits), [visibleUnits])
  const scoresReady = units.length > 0 && units.every((unit) => typeof unit.kitchenMinutes === 'number')
  const formattedDate = date.split('-').reverse().join('/')

  return (
    <section className="overflow-hidden rounded-[28px] bg-[#0A1228] text-[#F7F4EC] shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1.6px] text-[#F4B942]"><Trophy size={13} /> Competição entre unidades</p>
          <h2 className="mt-1 font-display text-3xl">Ranking diário em tempo real</h2>
          <p className="mt-1 text-sm text-white/65">Vendas e tempo médio da cozinha · {formattedDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6FE2A2]/10 px-3 py-1.5 text-xs font-bold text-[#6FE2A2]"><Wifi size={13} /> AO VIVO</span>
          {updatedAt ? <span className="text-xs text-white/50">Atualizado às {updatedAt}</span> : null}
          <Button type="button" variant="outline" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </Button>
        </div>
      </header>

      {error ? <p className="mx-5 mt-5 rounded-xl bg-[#7A5B20]/35 px-4 py-3 text-sm text-[#F7D98B] sm:mx-7">{error}</p> : null}
      <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-7">
        {ranking.map((unit, index) => {
          const position = rankingPosition(ranking, index, (item) => item.totalPoints)
          return (
            <Link
              key={unit.id}
              to={UNIT_PATHS[unit.id]}
              className={`group rounded-2xl border p-4 transition hover:-translate-y-0.5 ${position === 1 && scoresReady ? 'border-[#F4B942]/55 bg-[#F4B942]/10' : 'border-white/10 bg-white/[0.06] hover:bg-white/[0.1]'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${position === 1 && scoresReady ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/10 text-white/75'}`}>{scoresReady ? position : '—'}</span>
                  <p className="font-display text-2xl">{unit.name}</p>
                </div>
                <span className="font-display text-xl text-[#F4B942]">{scoresReady ? `${unit.totalPoints} pts` : 'calculando'}</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-black/15 px-3 py-3">
                  <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/45"><ShoppingBag size={12} /> Vendas</p>
                  <p className="mt-1 font-display text-xl">{unit.orders}</p>
                  <p className="text-[11px] font-bold text-[#F4B942]">+{unit.salesPoints} pts</p>
                </div>
                <div className="rounded-xl bg-black/15 px-3 py-3">
                  <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/45"><Clock3 size={12} /> Tempo médio</p>
                  <p className="mt-1 font-display text-xl">{typeof unit.kitchenMinutes === 'number' ? `${unit.kitchenMinutes.toLocaleString('pt-BR')} min` : '—'}</p>
                  <p className="text-[11px] font-bold text-[#F4B942]">{typeof unit.kitchenMinutes === 'number' ? `+${unit.kitchenPoints} pts` : 'aguardando'}</p>
                </div>
              </div>
              <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#EFE3C4]">Abrir operação da unidade <ExternalLink size={13} className="transition group-hover:translate-x-0.5" /></p>
            </Link>
          )
        })}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-3 text-[11px] font-semibold text-white/40 sm:px-7">
        <span>Atualização automática a cada 1 minuto</span>
        <Link to="/tv/competicao?aba=ranking&periodo=dia" className="text-[#F4B942] transition hover:text-[#F8D777]">Abrir ranking na TV →</Link>
      </footer>
    </section>
  )
}
