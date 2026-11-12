import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** URL pública do projeto. O Vite injeta VITE_* no build; o fallback cobre o deploy sem env no Vercel. */
const PROJECT_URL = 'https://pbyimrsfgnqrdmkojvdr.supabase.co'

/** Chave publishable do frontend. Não é service_role; o acesso continua nas policies RLS. */
const PUBLISHABLE_KEY = 'sb_publishable_REfzMIgmsXAP__r6WBIG-A_plxMy41i'

function usable(value: unknown, blocked: string[]) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (trimmed.length < 20) return ''
  if (blocked.some((piece) => trimmed.includes(piece))) return ''
  return trimmed
}

function supabaseUrl() {
  return usable(import.meta.env.VITE_SUPABASE_URL, ['seu-projeto']) || PROJECT_URL
}

function supabaseKey() {
  return (
    usable(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, ['sua-anon', 'your-anon']) ||
    usable(import.meta.env.VITE_SUPABASE_ANON_KEY, ['sua-anon', 'your-anon']) ||
    PUBLISHABLE_KEY
  )
}

let database: SupabaseClient | null | undefined

/** Um cliente só, usado pelo site de vagas e pelo painel do RH. */
export function getSupabase() {
  if (database !== undefined) return database
  const url = supabaseUrl()
  const key = supabaseKey()
  database = url && key ? createClient(url, key) : null
  return database
}
