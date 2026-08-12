import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { MOCK_ACCOUNTS } from '@/lib/mockAuth'
import { BrandMark } from '@/components/Layout'
import { Button, Field, Input } from '@/components/ui'

/** Login / cadastro só para candidatos (página pública de vagas) */
export function AuthPage() {
  const { signIn, signUp, signInAsMock, user, profile, loading, mockMode, sqliteMode } = useAuth()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') || '/candidato'
  const navigate = useNavigate()

  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const candidatePreset = MOCK_ACCOUNTS.find((a) => a.profile.role === 'candidate')

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
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="animate-fade-up w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Link to="/">
            <BrandMark />
          </Link>
        </div>

        <div className="rounded-[18px] bg-[#FBF9F3] p-8 shadow-[0_30px_70px_rgba(0,0,0,0.45)]">
          <p className="text-center text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--pv-terracotta)]">
            Área do candidato
          </p>
          <h1 className="mt-1 font-display text-center text-[22px] font-bold text-[var(--pv-navy)]">
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </h1>
          <p className="mt-1 text-center text-[13px] text-[#6B664F]">
            {sqliteMode
              ? 'Contas salvas no SQLite local de teste'
              : 'Veja vagas, complete seu perfil e candidate-se. Seus dados vão para o RH.'}
          </p>

          {mockMode && !sqliteMode && candidatePreset && (
            <button
              type="button"
              disabled={busy}
              className="mt-5 flex w-full items-center rounded-xl border-[1.5px] border-[#E7E2D3] bg-white px-3.5 py-3 text-left hover:border-[var(--pv-terracotta)]"
              onClick={() => void signInAsMock(candidatePreset.email, candidatePreset.password)}
            >
              <div>
                <div className="font-bold text-[var(--pv-navy)]">Entrar como candidato demo</div>
                <div className="text-[12.5px] text-[#6B664F]">Perfil já preenchido para testar</div>
              </div>
            </button>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-[#F1EDE0] p-1">
            <button
              type="button"
              className={`rounded-lg py-2 text-sm font-bold ${mode === 'login' ? 'bg-white text-[var(--pv-navy)] shadow-sm' : 'text-[#6B664F]'}`}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={`rounded-lg py-2 text-sm font-bold ${mode === 'signup' ? 'bg-white text-[var(--pv-navy)] shadow-sm' : 'text-[#6B664F]'}`}
              onClick={() => setMode('signup')}
            >
              Cadastro
            </button>
          </div>

          <form className="mt-4 space-y-3.5" onSubmit={(e) => void onSubmit(e)}>
            {mode === 'signup' && (
              <Field label="Nome completo">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Seu nome" />
              </Field>
            )}
            <Field label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="voce@email.com"
              />
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={3}
                placeholder="Crie uma senha"
              />
            </Field>
            {error ? <p className="text-sm font-semibold text-[#B23B3B]">{error}</p> : null}
            <Button type="submit" className="mt-2 w-full" disabled={busy}>
              {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta e continuar'}
            </Button>
          </form>

          <p className="mt-5 text-center text-[12px] text-[#6B664F]">
            <Link to="/" className="font-semibold text-[var(--pv-navy)]">
              ← Voltar às vagas
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
