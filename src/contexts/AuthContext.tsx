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
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>
  updateLocalProfile: (patch: Partial<Profile>) => void
  signOut: () => Promise<void>
  isStaff: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) {
    console.error('Erro ao carregar perfil:', error.message)
    return null
  }
  return data as Profile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const syncUser = useCallback(async (nextUser: User | null) => {
    setUser(nextUser)
    if (!nextUser) {
      setProfile(null)
      return
    }

    let nextProfile = await fetchProfile(nextUser.id)
    if (!nextProfile) {
      const { error } = await supabase.from('profiles').upsert(
        {
          id: nextUser.id,
          email: nextUser.email,
          full_name:
            (nextUser.user_metadata?.full_name as string | undefined) ||
            nextUser.email?.split('@')[0] ||
            'Usuário',
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      if (error) console.error(error.message)
      nextProfile = await fetchProfile(nextUser.id)
    }
    setProfile(nextProfile)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      console.error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }

    let mounted = true
    let unsubscribe: (() => void) | undefined

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      await syncUser(data.session?.user ?? null)
      if (mounted) setLoading(false)

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        void syncUser(session?.user ?? null)
      })
      unsubscribe = () => subscription.unsubscribe()
    })()

    return () => {
      mounted = false
      unsubscribe?.()
    }
  }, [syncUser])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const next = await fetchProfile(user.id)
    if (next) setProfile(next)
  }, [user])

  const updateLocalProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      void supabase
        .from('profiles')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', prev.id)
        .then(({ error }) => {
          if (error) console.error(error.message)
        })
      return next
    })
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) return { error: error.message }
      await syncUser(data.user)
      return {}
    },
    [syncUser],
  )

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      if (!email.trim()) return { error: 'Informe um e-mail' }
      if (password.length < 6) return { error: 'A senha precisa ter pelo menos 6 caracteres' }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      if (error) return { error: error.message }
      if (!data.user) return { error: 'Não foi possível criar a conta' }

      if (data.session?.user) {
        await syncUser(data.session.user)
        return {}
      }

      // Autoconfirm pode retornar sessão null em alguns casos — tenta login direto
      return signIn(email.trim(), password)
    },
    [signIn, syncUser],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      refreshProfile,
      signIn,
      signUp,
      updateLocalProfile,
      signOut,
      isStaff: profile?.role === 'admin' || profile?.role === 'lider',
      isAdmin: profile?.role === 'admin',
    }),
    [user, profile, loading, refreshProfile, signIn, signUp, updateLocalProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
