import { ExternalLink, RefreshCw, ShoppingBag, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { COMPETITION_UNIT_IDS, fetchCompetitionUnit } from '@/features/dirceu/competitionClient'

type CompetitionUnit = {
  id: 'dirceu' | 'promorar' | 'mocambinho'
  name: string
  orders: number
}

const UNIT_PATHS: Record<CompetitionUnit['id'], string> = {
  dirceu: '/admin/unidade/unit-dirceu',
  promorar: '/admin/unidade/unit-promorar',
  mocambinho: '/admin/unidade/unit-mocambinho',
}

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
        const collected: CompetitionUnit[] = []
        let failure = ''
        for (const unitId of COMPETITION_UNIT_IDS) {
          if (controller.signal.aborted) return
          try {
            const payload = await fetchCompetitionUnit({ unitId, period: 'dia', signal: controller.signal })
            if (!payload.unit) continue
            collected.push({ id: payload.unit.id as CompetitionUnit['id'], name: payload.unit.name, orders: payload.unit.orders ?? 0 })
            setUnits([...collected])
            if (payload.fetchedAt) setUpdatedAt(new Date(payload.fetchedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
          } catch (reason) {
            if (reason instanceof DOMException && reason.name === 'AbortError') return
            failure = reason instanceof Error ? reason.message : failure
          }
        }
        if (!collected.length) throw new Error(failure || 'Não foi possível atualizar a operação.')
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

  const ranking = [...units].sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name))

  return (
    <section className="overflow-hidden rounded-[28px] bg-[#0A1228] text-[#F7F4EC] shadow-xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-7">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1.6px] text-[#F4B942]"><Trophy size={13} /> Operação Saipos</p>
          <h2 className="mt-1 font-display text-3xl">Comparativo entre unidades</h2>
          <p className="mt-1 text-sm text-white/65">Mesa e delivery por unidade, sem balcão, ficha ou cancelados. Clique para abrir o detalhamento de cada casa.</p>
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
          { id: 'dirceu', name: 'Dirceu', orders: 0 },
          { id: 'promorar', name: 'Promorar', orders: 0 },
          { id: 'mocambinho', name: 'Mocambinho', orders: 0 },
        ] as CompetitionUnit[])).map((unit, _index, rankedUnits) => (
          <Link
            key={unit.id}
            to={UNIT_PATHS[unit.id]}
            className="group rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.1]"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-2xl">{unit.name}</p>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-[#F4B942]">#{rankedUnits.findIndex((item) => item.orders === unit.orders) + 1}</span>
            </div>
            <p className="mt-4 inline-flex items-center gap-1.5 font-display text-2xl text-[#F4B942]"><ShoppingBag size={18} /> {unit.orders} vendas</p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#EFE3C4]">Abrir operação da unidade <ExternalLink size={13} className="transition group-hover:translate-x-0.5" /></p>
          </Link>
        ))}
      </div>
    </section>
  )
}
