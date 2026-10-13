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
  Clock,
  UserCog,
  Store,
  PieChart,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { BrandMark, LoadingScreen } from '@/components/Layout'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  adminOnly?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const STATIC_GROUPS: NavGroup[] = [
  {
    title: 'Gestão',
    items: [
      { to: '/admin', end: true, label: 'Visão geral', icon: LayoutDashboard },
      { to: '/admin/ponto', label: 'Ponto eletrônico', icon: Clock },
      { to: '/admin/gerentes', label: 'Gerentes', icon: UserCog },
    ],
  },
  {
    title: 'RH',
    items: [
      { to: '/admin/rh', label: 'Painel de RH', icon: PieChart },
      { to: '/admin/vagas', label: 'Vagas', icon: Briefcase },
      { to: '/admin/candidatos', label: 'Banco de talentos', icon: Users },
      { to: '/admin/quadro', label: 'Quadro de seleção', icon: KanbanSquare },
      { to: '/admin/selecao', label: 'Seleção com IA', icon: Sparkles },
    ],
  },
  {
    title: 'Configurações',
    items: [{ to: '/admin/unidades', label: 'Cadastro de unidades', icon: Building2, adminOnly: true }],
  },
]

export function AdminShell() {
  const { loading, isStaff, isAdmin, signOut } = useAuth()
  const { store } = useData()

  if (loading) return <LoadingScreen text="Abrindo painel…" />
  if (!isStaff) return <Navigate to="/admin/login" replace />

  const unitGroup: NavGroup = {
    title: 'Unidades',
    items: store.units.map((u) => ({ to: `/admin/unidade/${u.id}`, label: u.name, icon: Store })),
  }
  const groups = [STATIC_GROUPS[0], unitGroup, ...STATIC_GROUPS.slice(1)]
    .map((g) => ({ ...g, items: g.items.filter((item) => !item.adminOnly || isAdmin) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="border-b border-white/10 bg-[#0A1228]/95 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="px-5 py-5">
          <BrandMark />
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[rgba(239,227,196,0.2)] bg-[rgba(239,227,196,0.08)] px-3 py-2.5">
            <div className="flex -space-x-2">
              <OwnerInitial letter="M" color="#E15B3F" />
              <OwnerInitial letter="A" color="#3B6EA5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#F7F4EC]">Matheus & Andressa</p>
              <p className="mt-0.5 text-[11px] font-medium text-[var(--pv-cream)]/60">Sócios · acesso total</p>
            </div>
          </div>
        </div>

        <nav className="pv-scroll flex gap-1 overflow-x-auto px-3 pb-4 lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-y-auto lg:overflow-x-visible">
          {groups.map((group) => (
            <div key={group.title} className="contents lg:mb-4 lg:block">
              <p className="hidden px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[1.6px] text-[var(--pv-cream)]/40 lg:block">
                {group.title}
              </p>
              {group.items.map((item) => (
                <SideLink key={item.to} item={item} />
              ))}
            </div>
          ))}
        </nav>

        <div className="hidden space-y-2 px-3 pb-6 pt-2 lg:block">
          <Link to="/">
            <Button variant="outline" size="sm" className="w-full justify-start">
              <ExternalLink size={14} /> Site de vagas
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => void signOut()}>
            <LogOut size={14} /> Sair
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 lg:hidden">
          <p className="truncate text-xs font-semibold text-[var(--pv-cream)]/70">Matheus & Andressa · Sócios</p>
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline" size="sm" aria-label="Site de vagas">
                <ExternalLink size={14} />
              </Button>
            </Link>
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

function SideLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold whitespace-nowrap transition lg:mb-0.5',
          isActive
            ? 'bg-[var(--pv-terracotta)] text-white shadow-[0_8px_18px_rgba(225,91,63,0.28)]'
            : 'text-[#EFE3C4] hover:bg-white/10 hover:text-white',
        )
      }
    >
      <Icon size={16} />
      {item.label}
    </NavLink>
  )
}

function OwnerInitial({ letter, color }: { letter: string; color: string }) {
  return (
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-[#0A1228]"
      style={{ background: color }}
    >
      {letter}
    </span>
  )
}
