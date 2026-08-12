import { NavLink, Outlet, Navigate, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  KanbanSquare,
  Briefcase,
  Users,
  Sparkles,
  LogOut,
  RotateCcw,
  ExternalLink,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { BrandMark, LoadingScreen } from '@/components/Layout'
import { Button } from '@/components/ui'
import { UNIT_CENTRO } from '@/lib/mockData'

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/quadro', end: false, label: 'Quadro', icon: KanbanSquare },
  { to: '/admin/vagas', end: false, label: 'Vagas', icon: Briefcase },
  { to: '/admin/candidatos', end: false, label: 'Candidatos', icon: Users },
  { to: '/admin/selecao', end: false, label: 'Seleção', icon: Sparkles },
]

export function AdminShell() {
  const { profile, loading, isStaff, isAdmin, signOut } = useAuth()
  const { resetStore } = useData()

  if (loading) return <LoadingScreen text="Abrindo painel…" />
  if (!isStaff) return <Navigate to="/auth?redirect=/admin" replace />

  // garante unit_id do líder no mock
  const unitLabel = isAdmin
    ? 'Administrador'
    : `Líder · ${profile?.unit_id === UNIT_CENTRO || !profile?.unit_id ? 'Unidade Centro' : 'Unidade'}`

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-white/10 bg-[#0E1730]/95 lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="px-5 py-5">
          <BrandMark />
          <div className="mt-4 rounded-full border border-[rgba(239,227,196,0.25)] bg-[rgba(239,227,196,0.1)] px-3 py-1.5 text-center text-[12px] font-semibold text-[var(--pv-cream)]">
            {unitLabel}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible">
          {NAV.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition ${
                  isActive
                    ? 'bg-[var(--pv-terracotta)] text-white'
                    : 'text-[var(--pv-cream)]/75 hover:bg-white/5 hover:text-[var(--pv-cream)]'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden space-y-2 px-3 pb-6 lg:block">
          <Link to="/">
            <Button variant="outline" size="sm" className="w-full">
              <ExternalLink size={14} /> Site de vagas
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="w-full" onClick={resetStore}>
            <RotateCcw size={14} /> Resetar dados mock
          </Button>
          <Button variant="outline" size="sm" className="w-full" onClick={() => void signOut()}>
            <LogOut size={14} /> Sair
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex items-center justify-end gap-2 border-b border-white/10 px-4 py-3 lg:hidden">
          <Button variant="outline" size="sm" onClick={resetStore}>
            <RotateCcw size={14} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut size={14} />
          </Button>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
