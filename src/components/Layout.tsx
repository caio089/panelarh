import { Link, NavLink } from 'react-router-dom'
import { LogOut, Briefcase, LayoutDashboard, Inbox } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export function BrandMark({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo-panela-velha.png"
        alt="Panela Velha"
        className={cn('object-contain drop-shadow-sm', compact ? 'h-9 w-auto' : 'h-12 w-auto sm:h-14')}
      />
      {!compact && (
        <div className="hidden min-[400px]:block">
          <div
            className={cn(
              'font-display text-[15px] leading-none tracking-tight sm:text-base',
              light ? 'text-[var(--pv-navy)]' : 'text-[#F7F4EC]',
            )}
          >
            Panela Velha
          </div>
          <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[1.5px] text-[var(--pv-terracotta)]">
            Recrutamento
          </div>
        </div>
      )}
    </div>
  )
}

export function PublicHeader() {
  const { isStaff, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0E1730]/78 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5">
        <Link to="/" aria-label="Panela Velha — início" className="min-w-0">
          <BrandMark />
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              cn(
                'hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition sm:inline-flex',
                isActive
                  ? 'bg-white/10 text-[var(--pv-cream)]'
                  : 'text-[var(--pv-cream)]/75 hover:bg-white/5 hover:text-[var(--pv-cream)]',
              )
            }
          >
            <Briefcase size={14} /> Vagas
          </NavLink>

          {isStaff ? (
            <>
              <NavLink
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(239,227,196,0.3)] px-3 py-2 text-[12.5px] font-semibold text-[var(--pv-cream)] transition hover:bg-white/5"
              >
                <LayoutDashboard size={14} />
                <span className="hidden sm:inline">Painel RH</span>
                <span className="sm:hidden">RH</span>
              </NavLink>
              <Button variant="outline" size="sm" onClick={() => void signOut()}>
                <LogOut size={14} />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </>
            ) : (
            <Link to="/">
              <Button size="sm">Ver vagas</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-panela-velha.png" alt="" className="h-8 w-auto opacity-90" />
          <p className="text-xs text-[var(--pv-cream)]/55">
            © {new Date().getFullYear()} Panela Velha · Recrutamento & Seleção
          </p>
        </div>
        <p className="text-xs text-[var(--pv-cream)]/45">
          Processo seletivo interno · dados tratados com cuidado
        </p>
        <Link
          to="/admin/login"
          className="text-xs font-semibold text-[var(--pv-cream)]/55 transition hover:text-[var(--pv-cream)]"
        >
          Acesso RH
        </Link>
      </div>
    </footer>
  )
}

export function LoadingScreen({ text = 'Carregando…' }: { text?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6">
      <img
        src="/logo-panela-velha.png"
        alt="Panela Velha"
        className="pv-logo-breathe h-[72px] w-auto object-contain drop-shadow-lg"
      />
      <div className="text-center">
        <p className="font-display tracking-wide text-[var(--pv-cream)]">{text}</p>
        <div className="mx-auto mt-4 h-1 w-28 overflow-hidden rounded-full bg-white/10">
          <div className="pv-progress-bar h-full w-1/2 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  tone = 'light',
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  tone?: 'light' | 'dark'
  icon?: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-2xl px-6 py-12 text-center',
        tone === 'dark' ? 'pv-empty-dark' : 'border border-dashed border-[#C7C0AA] bg-white/70',
      )}
    >
      <div
        className={cn(
          'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl',
          tone === 'dark' ? 'bg-white/8 text-[var(--pv-cream)]' : 'bg-[#F1EDE0] text-[var(--pv-navy)]',
        )}
      >
        {icon || <Inbox size={20} />}
      </div>
      <p
        className={cn(
          'font-display text-lg',
          tone === 'dark' ? 'text-[#F7F4EC]' : 'text-[var(--pv-navy)]',
        )}
      >
        {title}
      </p>
      {description ? (
        <p
          className={cn(
            'mx-auto mt-2 max-w-md text-sm leading-relaxed',
            tone === 'dark' ? 'text-[var(--pv-cream)]/65' : 'text-[var(--pv-muted)]',
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}
