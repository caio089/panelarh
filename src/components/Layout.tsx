import { Link, NavLink } from 'react-router-dom'
import { LogOut, Briefcase, LayoutDashboard, UserRound } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo-panela-velha.png"
        alt="Panela Velha"
        className={`object-contain ${compact ? 'h-9 w-auto' : 'h-12 w-auto sm:h-14'}`}
      />
      {!compact && (
        <div className="hidden min-[380px]:block">
          <div className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--pv-terracotta)]">
            Recrutamento & Seleção
          </div>
        </div>
      )}
    </div>
  )
}

export function PublicHeader() {
  const { user, profile, isStaff, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#121D40]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link to="/">
          <BrandMark />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold ${
                isActive ? 'bg-white/10 text-[var(--pv-cream)]' : 'text-[var(--pv-cream)]/80 hover:bg-white/5'
              }`
            }
          >
            <Briefcase size={14} /> Vagas
          </NavLink>

          {/* Admin só aparece se já estiver logado como staff (link próprio: /admin/login) */}
          {isStaff && (
            <NavLink
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(239,227,196,0.35)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--pv-cream)]"
            >
              <LayoutDashboard size={14} /> Painel RH
            </NavLink>
          )}

          {user && !isStaff ? (
            <>
              <NavLink
                to="/candidato"
                className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(239,227,196,0.12)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--pv-cream)]"
              >
                <UserRound size={14} />
                <span className="max-w-[120px] truncate">{profile?.full_name || 'Minha área'}</span>
              </NavLink>
              <Button variant="outline" size="sm" onClick={() => void signOut()}>
                <LogOut size={14} /> Sair
              </Button>
            </>
          ) : !user ? (
            <Link to="/auth">
              <Button size="sm">Área do candidato</Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut size={14} /> Sair
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}

export function LoadingScreen({ text = 'Carregando…' }: { text?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <img
        src="/logo-panela-velha.png"
        alt="Panela Velha"
        className="h-20 w-auto object-contain drop-shadow-lg"
      />
      <p className="font-display tracking-wide text-[var(--pv-cream)]">{text}</p>
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#C7C0AA] bg-white/60 px-6 py-10 text-center">
      <p className="font-display text-lg text-[var(--pv-navy)]">{title}</p>
      {description ? <p className="mt-2 text-sm text-[#6B664F]">{description}</p> : null}
    </div>
  )
}
