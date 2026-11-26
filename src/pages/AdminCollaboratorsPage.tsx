import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCw, Search, Users } from 'lucide-react'
import { loadAdminOverview } from '@/lib/adminOverviewDb'
import { loadAdminUnitPeople, type AdminUnitPerson } from '@/lib/adminPeopleDb'
import { shiftIsoDate, todayInFortaleza } from '@/features/dirceu/day'

type PersonWithUnit = AdminUnitPerson & { unit_name: string }

/** Visão administrativa limitada a nome, cargo, unidade e situação. */
export function AdminCollaboratorsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const unitFilter = searchParams.get('unidade') || 'todas'
  const [people, setPeople] = useState<PersonWithUnit[]>([])
  const [units, setUnits] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const today = todayInFortaleza()
      const overview = await loadAdminOverview(shiftIsoDate(today, -29), today)
      const names = overview.units.map((unit) => unit.name)
      const snapshots = await Promise.all(names.map((name) => loadAdminUnitPeople(name)))
      setUnits(names)
      setPeople(snapshots.flatMap((snapshot) => snapshot.people.map((person) => ({ ...person, unit_name: snapshot.unit_name }))))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os colaboradores.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return people.filter((person) =>
      (unitFilter === 'todas' || person.unit_name === unitFilter) &&
      (!term || `${person.full_name} ${person.job_title} ${person.unit_name}`.toLocaleLowerCase('pt-BR').includes(term)),
    )
  }, [people, unitFilter, search])
  const active = visible.filter((person) => person.status === 'ativo').length

  return <div className="space-y-5 px-5 py-6 sm:px-8 sm:py-8">
    <div>
      <Link to="/admin" className="text-sm font-semibold text-white/70 hover:text-white">← Visão geral da rede</Link>
      <p className="pv-eyebrow mt-5">Pessoas e acesso</p>
      <h1 className="font-display text-3xl text-white sm:text-4xl">Colaboradores</h1>
      <p className="mt-2 text-sm text-white/70">Equipe cadastrada pelo RH em todas as unidades.</p>
    </div>
    <div className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto flex items-center gap-2 text-[var(--pv-ink)]"><Users size={20} className="text-[var(--pv-terracotta)]" /><strong>{active} ativos</strong><span className="text-sm text-[var(--pv-muted)]">· {visible.length} no total</span></div>
        <select aria-label="Filtrar por unidade" value={unitFilter} onChange={(event) => setSearchParams(event.target.value === 'todas' ? {} : { unidade: event.target.value })} className="min-h-10 rounded-xl border border-[var(--pv-line-strong)] bg-white px-3 text-sm text-[var(--pv-ink)]"><option value="todas">Todas as unidades</option>{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select>
        <label className="relative min-w-52 flex-1 sm:flex-none"><Search size={15} className="absolute left-3 top-3 text-[var(--pv-muted)]" /><input aria-label="Buscar colaborador" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, cargo ou unidade" className="min-h-10 w-full rounded-xl border border-[var(--pv-line-strong)] bg-white pl-9 pr-3 text-sm text-[var(--pv-ink)]" /></label>
        <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--pv-line-strong)] px-3 text-sm font-semibold text-[var(--pv-ink)] disabled:opacity-50"><RefreshCw size={15} /> Atualizar</button>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {loading ? <p role="status" className="py-8 text-center text-sm text-[var(--pv-muted)]">Carregando colaboradores…</p> : visible.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{visible.map((person) => <article key={person.id} className="rounded-xl border border-[var(--pv-line)] bg-white p-4"><p className="font-bold text-[var(--pv-ink)]">{person.full_name}</p><p className="mt-1 text-sm text-[var(--pv-muted)]">{person.job_title}</p><p className="mt-2 text-xs font-semibold text-[var(--pv-terracotta)]">{person.unit_name} · {person.status === 'ativo' ? 'Ativo' : 'Inativo'}</p></article>)}</div> : <p className="py-8 text-center text-sm text-[var(--pv-muted)]">Nenhum colaborador encontrado.</p>}
    </div>
  </div>
}
