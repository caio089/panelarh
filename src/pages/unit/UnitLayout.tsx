import { Link, Navigate, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, LayoutDashboard, Users } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { cn } from '@/lib/utils'
import { loadAdminUnitPeople, type AdminUnitPerson } from '@/lib/adminPeopleDb'
import type { UnitOutletContext } from './unitContext'

const TABS = [
  { path: '', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { path: 'colaboradores', label: 'Colaboradores', icon: Users, end: false },
  { path: 'escala', label: 'Escala da semana', icon: CalendarDays, end: false },
]

/** Casca das páginas de unidade: cabeçalho, troca de unidade e abas. */
export function UnitLayout() {
  const { unitId = '' } = useParams()
  const { pathname } = useLocation()
  const { store } = useData()
  const unit = store.units.find((u) => u.id === unitId)
  const unitName = unit?.name
  const [people, setPeople] = useState<AdminUnitPerson[]>([])
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(true)
  const [collaboratorsError, setCollaboratorsError] = useState('')
  const reloadCollaborators = useCallback(async () => {
    setCollaboratorsLoading(true)
    setCollaboratorsError('')
    setPeople([])
    try { setPeople(unitName ? (await loadAdminUnitPeople(unitName)).people : []) }
    catch (reason) { setCollaboratorsError(reason instanceof Error ? reason.message : 'Não foi possível carregar a equipe.') }
    finally { setCollaboratorsLoading(false) }
  }, [unitName])
  useEffect(() => { void reloadCollaborators() }, [reloadCollaborators])

  if (!unit) return <Navigate to="/admin" replace />

  const team = people
  const activeCount = team.filter((c) => c.status === 'ativo').length
  const currentTab = TABS.find((t) => t.path && pathname.endsWith(`/${t.path}`))?.path ?? ''
  const base = `/admin/unidade/${unit.id}`

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--pv-cream)]/70 transition hover:text-white"
      >
        <ArrowLeft size={14} /> Visão geral da rede
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <p className="pv-eyebrow">Unidade</p>
          <h1 className="font-display text-3xl text-[#F7F4EC] sm:text-4xl">{unit.name}</h1>
          <div className="mt-3 flex items-center gap-2">
            <p className="text-sm text-[var(--pv-cream)]/80">
              {collaboratorsLoading ? 'Carregando equipe…' : collaboratorsError ? 'Equipe indisponível' : `${activeCount} colaboradores ativos`}
            </p>
          </div>
        </div>
        <nav className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1" aria-label="Trocar unidade">
          {store.units.map((u) => (
            <NavLink
              key={u.id}
              to={`/admin/unidade/${u.id}${currentTab ? `/${currentTab}` : ''}`}
              className={() =>
                cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold transition',
                  u.id === unit.id ? 'bg-[var(--pv-terracotta)] text-white' : 'text-[var(--pv-cream)]/70 hover:text-white',
                )
              }
            >
              {u.name}
            </NavLink>
          ))}
        </nav>
      </div>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-white/10" aria-label="Seções da unidade">
        {TABS.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={path ? `${base}/${path}` : base}
            end={end}
            className={({ isActive }) =>
              cn(
                '-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition',
                isActive
                  ? 'border-[var(--pv-terracotta)] text-white'
                  : 'border-transparent text-[var(--pv-cream)]/60 hover:text-white',
              )
            }
          >
            <Icon size={16} /> {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6">
        <Outlet context={{ unitId: unit.id, unitName: unit.name, collaborators: team, collaboratorsLoading, collaboratorsError, reloadCollaborators } satisfies UnitOutletContext} />
      </div>
    </div>
  )
}
