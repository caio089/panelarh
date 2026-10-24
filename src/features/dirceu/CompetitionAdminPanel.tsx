import { Clock3, ExternalLink, RefreshCw, ShoppingBag, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'

type CompetitionUnit = {
  id: 'dirceu' | 'promorar' | 'mocambinho'
  name: string
  sales: number
  orders: number
  kitchenMinutes: number | null
}

const UNIT_PATHS: Record<CompetitionUnit['id'], string> = {
  dirceu: '/admin/unidade/unit-dirceu',
  promorar: '/admin/unidade/unit-promorar',
  mocambinho: '/admin/unidade/unit-mocambinho',
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export function CompetitionAdminPanel() {
  const [units, setUnits] = useState<CompetitionUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      try {
        const response = await fetch('/api/competition', { signal: controller.signal })
        const payload = (await response.json()) as { error?: string; fetchedAt?: string; units?: CompetitionUnit[] }
        if (!response.ok || !payload.units) throw new Error(payload.error || 'Não foi possível atualizar a operação.')
        setUnits(payload.units)
        setUpdatedAt(payload.fetchedAt ? new Date(payload.fetchedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')
        setError('')
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a operação.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [refreshKey])

  const ranking = [...units].sort((a, b) => b.sales - a.sales)

  return (
    <section className="overflow-hidden rounded-[28px] bg-[#0A1228] text-[#F7F4EC] shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1.6px] text-[#F4B942]"><Trophy size={13} /> Operação Saipos</p>
          <h2 className="mt-1 font-display text-3xl">Comparativo entre unidades</h2>
          <p className="mt-1 text-sm text-white/65">Vendas, pedidos e ritmo da cozinha. Clique para abrir o detalhamento de cada casa.</p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt ? <span className="text-xs text-white/50">Atualizado às {updatedAt}</span> : null}
          <Button type="button" variant="outline" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </Button>
        </div>
      </header>

      {error ? <p className="mx-5 mt-5 rounded-xl bg-[#7A2F2F]/35 px-4 py-3 text-sm sm:mx-7">{error}</p> : null}
      <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-7">
        {(ranking.length ? ranking : ([
          { id: 'dirceu', name: 'Dirceu', sales: 0, orders: 0, kitchenMinutes: null },
          { id: 'promorar', name: 'Promorar', sales: 0, orders: 0, kitchenMinutes: null },
          { id: 'mocambinho', name: 'Mocambinho', sales: 0, orders: 0, kitchenMinutes: null },
        ] as CompetitionUnit[])).map((unit, index) => (
          <Link
            key={unit.id}
            to={UNIT_PATHS[unit.id]}
            className="group rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-2xl">{unit.name}</p>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-[#F4B942]">#{index + 1}</span>
            </div>
            <p className="mt-4 font-display text-2xl text-[#F4B942]">{money.format(unit.sales)}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-white/60"><ShoppingBag size={13} /> {unit.orders} pedidos</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-white/75"><Clock3 size={14} /> Cozinha: {unit.kitchenMinutes === null ? 'sem tempo disponível' : `${unit.kitchenMinutes.toLocaleString('pt-BR')} min`}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#EFE3C4]">Abrir operação da unidade <ExternalLink size={13} className="transition group-hover:translate-x-0.5" /></p>
          </Link>
        ))}
      </div>
    </section>
  )
}
