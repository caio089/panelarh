const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8787'

const TOKEN_KEY = 'panela_rh_api_token'

export function getApiToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setApiToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {})
  if (options.json !== undefined) headers.set('Content-Type', 'application/json')
  const token = getApiToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Erro HTTP ${res.status}`)
  }
  return data as T
}

export async function pingApi() {
  try {
    const res = await fetch(`${API_URL}/api/health`)
    return res.ok
  } catch {
    return false
  }
}

export { API_URL }
