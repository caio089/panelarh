import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { MOCK_ACCOUNTS } from '@/lib/mockAuth'
import { BrandMark } from '@/components/Layout'
import { Button, Field, Input } from '@/components/ui'

/** Link próprio do time RH — não aparece na página pública de vagas */
export function AdminLoginPage() {
  const { signIn, signInAsMock, user, profile, loading, mockMode, sqliteMode } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@panela.local')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const staffPresets = MOCK_ACCOUNTS.filter((a) => a.profile.role === 'admin' || a.profile.role === 'lider')

  useEffect(() => {
    if (loading || !user) return
    if (profile?.role === 'admin' || profile?.role === 'lider') {
      navigate('/admin', { replace: true })
      return
    }
    setError('Esta conta não é de administrador. Use o acesso de candidato em /auth.')
  }, [loading, user, profile, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    // SQLite: login real; senão mock
    const result = sqliteMode || !mockMode
      ? await signIn(email.trim(), password)
      : await signInAsMock(email.trim(), password === 'admin123' ? 'admin' : password)
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
            Acesso restrito
          </p>
          <h1 className="mt-1 font-display text-center text-[22px] font-bold text-[var(--pv-navy)]">
            Painel do administrador
          </h1>
          <p className="mt-1 text-center text-[13px] text-[#6B664F]">
            {sqliteMode
              ? 'SQLite local · admin@panela.local / admin123'
              : 'Link interno do RH — cadastro de vagas, pipeline e seleção.'}
          </p>

          {(mockMode || sqliteMode) && (
            <div className="mt-5 space-y-2">
              {staffPresets.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center rounded-xl border-[1.5px] border-[#E7E2D3] bg-white px-3.5 py-3 text-left hover:border-[var(--pv-terracotta)]"
                  onClick={() => {
                    setBusy(true)
                    setError('')
                    const emailUse = account.email
                    const passUse = sqliteMode && account.email === 'admin@panela.local' ? 'admin123' : account.password
                    setEmail(emailUse)
                    setPassword(passUse)
                    void (sqliteMode ? signIn(emailUse, passUse) : signInAsMock(emailUse, account.password)).then(
                      (r) => {
                        setBusy(false)
                        if (r.error) setError(r.error)
                      },
                    )
                  }}
                >
                  <div>
                    <div className="font-bold text-[var(--pv-navy)]">{account.label}</div>
                    <div className="text-[12.5px] text-[#6B664F]">{account.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <form className="mt-5 space-y-3.5" onSubmit={(e) => void onSubmit(e)}>
            <Field label="E-mail">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Senha">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error ? <p className="text-sm font-semibold text-[#B23B3B]">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Aguarde…' : 'Entrar no painel'}
            </Button>
          </form>

          <p className="mt-5 text-center text-[12px] text-[#6B664F]">
            É candidato?{' '}
            <Link to="/auth" className="font-semibold text-[var(--pv-terracotta)]">
              Acesse a área do candidato
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
