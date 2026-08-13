import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { BrandMark } from '@/components/Layout'
import { Alert, Button, Field, Input, SegmentedControl } from '@/components/ui'

export function AuthPage() {
  const { signIn, signUp, user, profile, loading } = useAuth()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') || '/candidato'
  const navigate = useNavigate()

  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loading || !user) return
    if (profile?.role === 'admin' || profile?.role === 'lider') {
      navigate('/admin', { replace: true })
      return
    }
    if (!profile?.onboarding_completed) {
      navigate(`/perfil?redirect=${encodeURIComponent(redirect)}`, { replace: true })
      return
    }
    navigate(redirect.startsWith('/admin') ? '/candidato' : redirect, { replace: true })
  }, [loading, user, profile, navigate, redirect])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const result =
      mode === 'login'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, fullName.trim())
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-20 h-64 w-64 rounded-full bg-[var(--pv-terracotta)]/20 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-[var(--pv-cream)]/10 blur-3xl" />
      </div>

      <div className="animate-fade-up relative w-full max-w-[440px]">
        <div className="mb-7 flex justify-center">
          <Link to="/" aria-label="Voltar ao início">
            <BrandMark />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[var(--pv-surface)] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-8">
          <p className="pv-eyebrow text-center">Área do candidato</p>
          <h1 className="mt-1 text-center font-display text-[24px] text-[var(--pv-navy)]">
            {mode === 'login' ? 'Bem-vindo de volta' : 'Comece sua candidatura'}
          </h1>
          <p className="mt-2 text-center text-[13px] leading-relaxed text-[var(--pv-muted)]">
            {mode === 'login'
              ? 'Acesse para acompanhar vagas, perfil e mensagens do RH.'
              : 'Crie sua conta, complete o perfil e candidate-se às vagas abertas.'}
          </p>

          <div className="mt-5">
            <SegmentedControl
              value={mode}
              onChange={(v) => {
                setMode(v as 'login' | 'signup')
                setError('')
              }}
              options={[
                { value: 'login', label: 'Entrar' },
                { value: 'signup', label: 'Criar conta' },
              ]}
            />
          </div>

          <form className="mt-5 space-y-3.5" onSubmit={(e) => void onSubmit(e)}>
            {mode === 'signup' ? (
              <Field label="Nome completo">
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Seu nome"
                />
              </Field>
            ) : null}
            <Field label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="voce@email.com"
              />
            </Field>
            <Field label="Senha" hint={mode === 'signup' ? 'Mínimo de 6 caracteres' : undefined}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={mode === 'login' ? 'Sua senha' : 'Crie uma senha'}
              />
            </Field>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <Button type="submit" className="mt-1 w-full" size="lg" disabled={busy}>
              {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta e continuar'}
            </Button>
          </form>

          <p className="mt-6 text-center text-[12.5px] text-[var(--pv-muted)]">
            É da equipe RH?{' '}
            <Link to="/admin/login" className="font-semibold text-[var(--pv-terracotta)] hover:underline">
              Entrar no painel
            </Link>
          </p>
          <p className="mt-3 text-center text-[12.5px] text-[var(--pv-muted)]">
            <Link to="/" className="font-semibold text-[var(--pv-navy)] hover:text-[var(--pv-terracotta)]">
              ← Voltar às vagas
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
