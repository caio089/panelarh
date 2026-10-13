import { Link, Navigate, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, LayoutDashboard, Users } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { cn } from '@/lib/utils'
import { useGestaoStore } from '@/features/gestao/GestaoStoreContext'
import { Avatar } from '@/features/gestao/components/atoms'
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
  const { colaboradores } = useGestaoStore()
  const unit = store.units.find((u) => u.id === unitId)

  if (!unit) return <Navigate to="/admin" replace />

  const team = colaboradores.filter((c) => c.unitId === unit.id)
  const activeCount = team.filter((c) => c.status === 'ativo').length
  const gerente = team.find((c) => c.isGerente && c.status === 'ativo')
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
            {gerente ? <Avatar name={gerente.nome} size={28} /> : null}
            <p className="text-sm text-[var(--pv-cream)]/80">
              {gerente ? (
                <>
                  <span className="font-semibold text-white">{gerente.nome}</span> · gerente ·{' '}
                </>
              ) : (
                'Sem gerente cadastrado · '
              )}
              {activeCount} colaboradores ativos
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
        <Outlet context={{ unitId: unit.id, unitName: unit.name } satisfies UnitOutletContext} />
      </div>
    </div>
  )
}