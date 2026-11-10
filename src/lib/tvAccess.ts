import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let database: SupabaseClient | null | undefined

export function tvSupabase() {
  if (database !== undefined) return database
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key || url.includes('seu-projeto')) {
    database = null
    return database
  }
  database = createClient(url, key, {
    auth: { storageKey: 'panela-tv-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return database
}
