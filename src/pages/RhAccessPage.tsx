import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { changeRhAccess } from '@/lib/rhAccess'
import { Alert, Button, Field, Input, NoticeModal, PageHeader } from '@/components/ui'

export function RhAccessPage() {
  const { user, isRh, updateRhEmail } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Informe o e-mail de acesso.')
      return
    }
    if (password.length < 6) {
      setError('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('A confirmação da senha não confere.')
      return
    }
    setSaving(true)
    try {
      await changeRhAccess(currentPassword, email, password)
      const nextEmail = email.trim().toLowerCase()
      updateRhEmail(nextEmail)
      setEmail(nextEmail)
      setCurrentPassword('')
      setPassword('')
      setConfirmPassword('')
      setNotice('Acesso atualizado. No próximo login, use este e-mail e esta senha.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar o acesso.')
    } finally {
      setSaving(false)
    }
  }

  if (!isRh) return <Navigate to="/admin" replace />

  return (
    <div className="px-5 py-6 sm:px-8">
      <PageHeader
        eyebrow="RH"
        title="Acesso"
        description="Troque o e-mail e a senha que a equipe usa para entrar no painel."
      />

      <form onSubmit={(event) => void onSubmit(event)} className="mt-6 max-w-lg rounded-2xl bg-[#FBF9F3] p-5 shadow-xl">
        <Field label="Senha atual">
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </Field>
        <div className="mt-4">
          <Field label="Novo e-mail">
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Nova senha">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Confirmar nova senha">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </Field>
        </div>
        {error ? (
          <div className="mt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar acesso'}
          </Button>
        </div>
      </form>
      <NoticeModal message={notice} title="Acesso atualizado" onClose={() => setNotice(null)} />
    </div>
  )
}
