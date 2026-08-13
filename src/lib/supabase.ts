import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string) || ''
/** Preferir anon JWT legado; publishable também funciona em clientes recentes. */
const anon =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  ''

if (!url || !anon) {
  console.warn('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env')
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export function isSupabaseConfigured() {
  return Boolean(
    url &&
      anon &&
      !url.includes('seu-projeto') &&
      !anon.includes('sua-anon'),
  )
}
