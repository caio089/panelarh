import { NavLink, Outlet, Navigate, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  KanbanSquare,
  Building2,
  Briefcase,
  Users,
  Sparkles,
  LogOut,
  ExternalLink,
  RotateCcw,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { BrandMark, LoadingScreen } from '@/components/Layout'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/quadro', end: false, label: 'Quadro', icon: KanbanSquare },
  { to: '/admin/unidades', end: false, label: 'Unidades', icon: Building2, adminOnly: true },
  { to: '/admin/vagas', end: false, label: 'Vagas', icon: Briefcase },
  { to: '/admin/candidatos', end: false, label: 'Candidatos', icon: Users },
  { to: '/admin/selecao', end: false, label: 'Seleção', icon: Sparkles },
]

export function AdminShell() {
  const { profile, loading, isStaff, isAdmin, signOut } = useAuth()
  const { store, resetDemoData } = useData()

  function confirmResetDemo() {
    if (window.confirm('Restaurar os dados de demonstração? Vagas, candidatos e unidades criados serão apagados.')) {
      resetDemoData()
    }
  }

  if (loading) return <LoadingScreen text="Abrindo painel…" />
  if (!isStaff) return <Navigate to="/admin/login" replace />

  const unitName = store.units.find((u) => u.id === profile?.unit_id)?.name
  const unitLabel = isAdmin ? 'Administrador' : `Líder${unitName ? ` · ${unitName}` : ''}`

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[252px_1fr]">
      <aside className="border-b border-white/10 bg-[#0A1228]/95 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="px-5 py-5">
          <BrandMark />
          <div className="mt-4 rounded-xl border border-[rgba(239,227,196,0.2)] bg-[rgba(239,227,196,0.08)] px-3 py-2.5">
            <p className="truncate text-[13px] font-semibold text-[#F7F4EC]">
              {profile?.full_name || 'Equipe RH'}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-[var(--pv-cream)]/60">{unitLabel}</p>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible">
          {NAV.filter((item) => !item.adminOnly || isAdmin).map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition',
                  isActive
                    ? 'bg-[var(--pv-terracotta)] text-white shadow-[0_8px_18px_rgba(225,91,63,0.28)]'
                    : 'text-[#EFE3C4] hover:bg-white/10 hover:text-white',
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden space-y-2 px-3 pb-6 lg:block">
          <Link to="/">
            <Button variant="outline" size="sm" className="w-full justify-start">
              <ExternalLink size={14} /> Site de vagas
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={confirmResetDemo}>
            <RotateCcw size={14} /> Restaurar demo
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => void signOut()}
          >
            <LogOut size={14} /> Sair
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 lg:hidden">
          <p className="truncate text-xs font-semibold text-[var(--pv-cream)]/70">{unitLabel}</p>
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline" size="sm" aria-label="Site de vagas">
                <ExternalLink size={14} />
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={confirmResetDemo} aria-label="Restaurar demo">
              <RotateCcw size={14} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => void signOut()} aria-label="Sair">
              <LogOut size={14} />
            </Button>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
