import { Outlet, Navigate, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  KanbanSquare,
  Users,
  Archive,
  Sparkles,
  LogOut,
  ExternalLink,
  UserCog,
  Store,
  PieChart,
  KeyRound,
  HeartHandshake,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isRhArea } from '@/lib/access'
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
      { to: '/admin/selecao', label: 'IA', icon: Sparkles },
      { to: '/admin/gerentes', label: 'Gerentes', icon: UserCog },
    ],
  },
  {
    title: 'RH',
    items: [
      { to: '/admin/pessoas', label: 'Central RH e DP', icon: HeartHandshake },
      { to: '/admin/rh', label: 'Painel de vagas', icon: PieChart },
    ],
  },
  {
    title: 'Configurações',
    items: [{ to: '/admin/unidades', label: 'Cadastro de unidades', icon: Building2, adminOnly: true }],
  },
]

const RH_GROUPS: NavGroup[] = [
  {
    title: 'Pessoas',
    items: [
      { to: '/admin/pessoas', label: 'Central RH e DP', icon: HeartHandshake },
      { to: '/admin/colaboradores', label: 'Colaboradores', icon: Users },
      { to: '/admin/pessoas?area=rh', label: 'RH · Treinamentos', icon: GraduationCap },
      { to: '/admin/pessoas?area=dp', label: 'DP · Documentos', icon: KeyRound },
    ],
  },
  {
    title: 'Recrutamento',
    items: [
      { to: '/admin/rh', label: 'Painel de vagas', icon: PieChart },
      { to: '/admin/vagas', label: 'Vagas', icon: Briefcase },
      { to: '/admin/quadro', label: 'Pipeline', icon: KanbanSquare },
      { to: '/admin/candidatos', label: 'Candidatos', icon: Users },
      { to: '/admin/candidatos?status=banco', label: 'Banco de talentos', icon: Archive },
      { to: '/admin/selecao', label: 'Seleção', icon: Sparkles },
      { to: '/admin/acesso', label: 'Acesso', icon: KeyRound },
    ],
  },
]

export function AdminShell() {
  const { loading, isStaff, isAdmin, isRh, signOut } = useAuth()
  const { store } = useData()
  const { pathname } = useLocation()

  if (loading) return <LoadingScreen text="Abrindo painel…" />
  if (!isStaff) return <Navigate to="/admin/login" replace />
  if (isRh && !isRhArea(pathname)) return <Navigate to="/admin/rh" replace />
  if (!isAdmin && !isRh) return <Navigate to="/" replace />

  const unitGroup: NavGroup = {
    title: 'Unidades',
    items: store.units.map((u) => ({ to: `/admin/unidade/${u.id}`, label: u.name, icon: Store })),
  }
  const groups = (isRh ? RH_GROUPS : [STATIC_GROUPS[0], unitGroup, ...STATIC_GROUPS.slice(1)])
    .map((g) => ({ ...g, items: g.items.filter((item) => !item.adminOnly || isAdmin) }))
    .filter((g) => g.items.length > 0)
  const who = isRh
    ? { title: 'Equipe de RH', detail: 'Recrutamento e seleção' }
    : { title: 'Matheus & Andressa', detail: 'Sócios · acesso total' }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="border-b border-white/10 bg-[#0A1228]/95 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="px-5 py-5">
          <BrandMark />
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[rgba(239,227,196,0.2)] bg-[rgba(239,227,196,0.08)] px-3 py-2.5">
            <div className="flex -space-x-2">
              {isRh ? (
                <OwnerInitial letter="R" color="#E15B3F" />
              ) : (
                <>
                  <OwnerInitial letter="M" color="#E15B3F" />
                  <OwnerInitial letter="A" color="#3B6EA5" />
                </>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#F7F4EC]">{who.title}</p>
              <p className="mt-0.5 text-[11px] font-medium text-[var(--pv-cream)]/60">{who.detail}</p>
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
          <p className="truncate text-xs font-semibold text-[var(--pv-cream)]/70">{who.title}</p>
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
  const { pathname, search } = useLocation()
  const talentView = search.includes('status=banco')
  const itemIsTalent = item.to.includes('status=banco')
  const onCandidates = pathname === '/admin/candidatos'
  const active = onCandidates
    ? itemIsTalent
      ? talentView
      : item.to === '/admin/candidatos' && !talentView
    : pathname === item.to || (!item.end && item.to.startsWith('/') && !item.to.includes('?') && pathname.startsWith(`${item.to}/`))
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold whitespace-nowrap transition lg:mb-0.5',
        active
          ? 'bg-[var(--pv-terracotta)] text-white shadow-[0_8px_18px_rgba(225,91,63,0.28)]'
          : 'text-[#EFE3C4] hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon size={16} />
      {item.label}
    </Link>
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
