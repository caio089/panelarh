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
  DEMO_ADMIN_PROFILE,
  DEMO_ADMIN_USER,
  endDemoSession,
  hasDemoSession,
  isValidDemoLogin,
  startDemoSession,
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
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(() => hasDemoSession())

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isValidDemoLogin(email, password)) return { error: 'E-mail ou senha inválidos.' }
    startDemoSession()
    setLoggedIn(true)
    return {}
  }, [])

  const signOut = useCallback(async () => {
    endDemoSession()
    setLoggedIn(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: loggedIn ? DEMO_ADMIN_USER : null,
      profile: loggedIn ? DEMO_ADMIN_PROFILE : null,
      loading: false,
      signIn,
      signOut,
      isStaff: loggedIn,
      isAdmin: loggedIn,
    }),
    [loggedIn, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
