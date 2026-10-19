import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { BrandMark } from '@/components/Layout'
import { Alert, Button, Field, Input } from '@/components/ui'
export function AdminLoginPage() {
  const { signIn, user, loading, isStaff, isRh } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading || !user) return
    if (!isStaff) return
    navigate(isRh ? '/admin/rh' : '/admin', { replace: true })
  }, [loading, user, isStaff, isRh, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const result = await signIn(email.trim(), password)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-[var(--pv-navy-light)]/40 blur-3xl" />
      </div>

      <div className="animate-fade-up relative w-full max-w-[440px]">
        <div className="mb-7 flex justify-center">
          <Link to="/" aria-label="Voltar ao início">
            <BrandMark />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[var(--pv-surface)] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-8">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--pv-navy)] text-[var(--pv-cream)]">
            <Shield size={18} />
          </div>
          <p className="pv-eyebrow text-center">Acesso restrito</p>
          <h1 className="mt-1 text-center font-display text-[24px] text-[var(--pv-navy)]">
            Painel do RH
          </h1>
          <p className="mt-2 text-center text-[13px] leading-relaxed text-[var(--pv-muted)]">
            Área interna para vagas, pipeline e seleção. Candidatos se candidatam pelo site, sem login.
          </p>

          <form className="mt-5 space-y-3.5" onSubmit={(e) => void onSubmit(e)}>
            <Field label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="seu@email.com"
              />
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Field>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? 'Aguarde…' : 'Entrar no painel'}
            </Button>
          </form>

          <p className="mt-6 text-center text-[12.5px] text-[var(--pv-muted)]">
            <Link to="/" className="font-semibold text-[var(--pv-terracotta)] hover:underline">
              ← Voltar ao site de vagas
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
