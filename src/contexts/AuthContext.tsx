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
  rememberRhEmail,
  rememberedRhEmail,
  startDemoSession,
  syncStaffCookie,
  type DemoUser,
} from '@/lib/demo/auth'
import { verifyRhLogin } from '@/lib/rhAccess'

interface AuthContextValue {
  user: DemoUser | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  updateRhEmail: (email: string) => void
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
  const [rhEmail, setRhEmail] = useState(rememberedRhEmail)

  const signIn = useCallback(async (email: string, password: string) => {
    const admin = findDemoAccount(email, password)
    if (admin?.profile.role === 'admin') {
      startDemoSession(admin.user.id)
      setSessionId(admin.user.id)
      return {}
    }

    const remote = await verifyRhLogin(email, password)
    if (remote === true) {
      rememberRhEmail(email)
      setRhEmail(email.trim().toLowerCase())
      startDemoSession('demo-rh')
      setSessionId('demo-rh')
      return {}
    }
    if (remote === false) return { error: 'E-mail ou senha inválidos.' }

    const fallback = findDemoAccount(email, password)
    if (fallback?.profile.role !== 'rh') return { error: 'E-mail ou senha inválidos.' }
    rememberRhEmail(fallback.user.email)
    setRhEmail(fallback.user.email)
    startDemoSession(fallback.user.id)
    setSessionId(fallback.user.id)
    return {}
  }, [])

  const updateRhEmail = useCallback((email: string) => {
    rememberRhEmail(email)
    setRhEmail(email.trim().toLowerCase())
  }, [])

  const signOut = useCallback(async () => {
    endDemoSession()
    setSessionId(null)
  }, [])

  const isRh = account?.profile.role === 'rh'
  const user = account
    ? { ...account.user, email: isRh ? rhEmail : account.user.email }
    : null
  const profile = account ? { ...account.profile, email: user?.email ?? account.profile.email } : null

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading: false,
      signIn,
      signOut,
      updateRhEmail,
      isStaff: account?.profile.role === 'admin' || account?.profile.role === 'rh',
      isAdmin: account?.profile.role === 'admin',
      isRh: account?.profile.role === 'rh',
    }),
    [account, user, profile, signIn, signOut, updateRhEmail],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
