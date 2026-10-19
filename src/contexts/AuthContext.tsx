import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Profile } from '@/types'
import {
  currentDemoSessionId,
  demoAccountById,
  endDemoSession,
  findDemoAccount,
  startDemoSession,
  syncStaffCookie,
  type DemoUser,
} from '@/lib/demo/auth'

interface AuthContextValue {
  user: DemoUser | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  isStaff: boolean
  isAdmin: boolean
  isRh: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState(() => {
    const id = currentDemoSessionId()
    syncStaffCookie(id)
    return id
  })
  const account = demoAccountById(sessionId)

  const signIn = useCallback(async (email: string, password: string) => {
    const next = findDemoAccount(email, password)
    if (!next) return { error: 'E-mail ou senha inválidos.' }
    startDemoSession(next.user.id)
    setSessionId(next.user.id)
    return {}
  }, [])

  const signOut = useCallback(async () => {
    endDemoSession()
    setSessionId(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: account?.user ?? null,
      profile: account?.profile ?? null,
      loading: false,
      signIn,
      signOut,
      isStaff: account?.profile.role === 'admin' || account?.profile.role === 'rh',
      isAdmin: account?.profile.role === 'admin',
      isRh: account?.profile.role === 'rh',
    }),
    [account, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
