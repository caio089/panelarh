import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types'
import {
  clearMockSession,
  createMockCandidate,
  findPresetAccount,
  loadMockSession,
  saveMockSession,
  type MockSession,
} from '@/lib/mockAuth'
import { api, getApiToken, pingApi, setApiToken } from '@/lib/api'

const USE_SQLITE = import.meta.env.VITE_USE_SQLITE === 'true'

interface AuthContextValue {
  session: MockSession | null
  user: User | null
  profile: Profile | null
  loading: boolean
  mockMode: boolean
  sqliteMode: boolean
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>
  signInAsMock: (email: string, password: string) => Promise<{ error?: string }>
  updateLocalProfile: (patch: Partial<Profile>) => void
  signOut: () => Promise<void>
  isStaff: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toUser(session: MockSession | null): User | null {
  if (!session) return null
  return {
    id: session.user.id,
    email: session.user.email,
    app_metadata: {},
    user_metadata: { full_name: session.profile.full_name },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MockSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [sqliteOnline, setSqliteOnline] = useState(false)

  const persistLocal = useCallback((next: MockSession | null) => {
    setSession(next)
    if (next) saveMockSession(next)
    else clearMockSession()
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (USE_SQLITE) {
        const ok = await pingApi()
        if (!mounted) return
        setSqliteOnline(ok)
        if (ok) {
          const token = getApiToken()
          if (token) {
            try {
              const me = await api<{ user: { id: string; email: string }; profile: Profile }>('/api/auth/me')
              if (!mounted) return
              const next = { user: me.user, profile: me.profile }
              setSession(next)
              saveMockSession(next)
              setLoading(false)
              return
            } catch {
              setApiToken(null)
            }
          }
          setLoading(false)
          return
        }
      }
      // fallback mock
      setSession(loadMockSession())
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (USE_SQLITE && sqliteOnline && getApiToken()) {
      try {
        const me = await api<{ user: { id: string; email: string }; profile: Profile }>('/api/auth/me')
        const next = { user: me.user, profile: me.profile }
        setSession(next)
        saveMockSession(next)
        return
      } catch {
        /* ignore */
      }
    }
    const current = loadMockSession()
    if (current) setSession(current)
  }, [sqliteOnline])

  const updateLocalProfile = useCallback(
    (patch: Partial<Profile>) => {
      setSession((prev) => {
        if (!prev) return prev
        const next = { ...prev, profile: { ...prev.profile, ...patch } }
        saveMockSession(next)

        if (USE_SQLITE && sqliteOnline && getApiToken()) {
          void api('/api/profile', { method: 'PATCH', json: patch }).catch(console.error)
        }
        return next
      })
    },
    [sqliteOnline],
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (USE_SQLITE && (sqliteOnline || (await pingApi()))) {
        try {
          setSqliteOnline(true)
          const data = await api<{
            token: string
            user: { id: string; email: string }
            profile: Profile
          }>('/api/auth/login', { method: 'POST', json: { email, password } })
          setApiToken(data.token)
          persistLocal({ user: data.user, profile: data.profile })
          return {}
        } catch (e) {
          return { error: e instanceof Error ? e.message : 'Erro no login' }
        }
      }

      const preset = findPresetAccount(email.trim(), password)
      if (preset) {
        persistLocal({
          user: { id: preset.profile.id, email: preset.email },
          profile: { ...preset.profile },
        })
        return {}
      }
      if (!email.trim() || password.length < 3) {
        return { error: 'Informe e-mail e senha' }
      }
      persistLocal(createMockCandidate(email.trim(), email.split('@')[0]))
      return {}
    },
    [persistLocal, sqliteOnline],
  )

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      if (!email.trim()) return { error: 'Informe um e-mail' }

      if (USE_SQLITE && (sqliteOnline || (await pingApi()))) {
        try {
          setSqliteOnline(true)
          const data = await api<{
            token: string
            user: { id: string; email: string }
            profile: Profile
          }>('/api/auth/register', {
            method: 'POST',
            json: { email, password, fullName },
          })
          setApiToken(data.token)
          persistLocal({ user: data.user, profile: data.profile })
          return {}
        } catch (e) {
          return { error: e instanceof Error ? e.message : 'Erro ao criar conta' }
        }
      }

      persistLocal(createMockCandidate(email.trim(), fullName.trim()))
      return {}
    },
    [persistLocal, sqliteOnline],
  )

  const signInAsMock = useCallback(
    async (email: string, password: string) => {
      // Preferências demo: se sqlite online e for admin seed, usa API
      if (USE_SQLITE && email === 'admin@panela.local' && (sqliteOnline || (await pingApi()))) {
        return signIn('admin@panela.local', 'admin123')
      }
      const preset = findPresetAccount(email.trim(), password)
      if (!preset) return { error: 'Conta demo não encontrada' }
      persistLocal({
        user: { id: preset.profile.id, email: preset.email },
        profile: { ...preset.profile },
      })
      return {}
    },
    [persistLocal, signIn, sqliteOnline],
  )

  const signOut = useCallback(async () => {
    if (USE_SQLITE && getApiToken()) {
      try {
        await api('/api/auth/logout', { method: 'POST' })
      } catch {
        /* ignore */
      }
      setApiToken(null)
    }
    persistLocal(null)
  }, [persistLocal])

  const profile = session?.profile ?? null

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: toUser(session),
      profile,
      loading,
      mockMode: !(USE_SQLITE && sqliteOnline),
      sqliteMode: USE_SQLITE && sqliteOnline,
      refreshProfile,
      signIn,
      signUp,
      signInAsMock,
      updateLocalProfile,
      signOut,
      isStaff: profile?.role === 'admin' || profile?.role === 'lider',
      isAdmin: profile?.role === 'admin',
    }),
    [
      session,
      profile,
      loading,
      sqliteOnline,
      refreshProfile,
      signIn,
      signUp,
      signInAsMock,
      updateLocalProfile,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
