import type { AppStore } from '@/lib/data'
import { buildDemoStore } from '@/lib/demo/seedData'

/** Versione a chave ao mudar o formato do seed para descartar dados antigos do navegador. */
const STORE_KEY = 'panela-demo-store-v1'

function isAppStore(value: unknown): value is AppStore {
  if (!value || typeof value !== 'object') return false
  const store = value as Record<string, unknown>
  return ['units', 'vagas', 'candidatos', 'profiles', 'experiences', 'messages'].every((key) =>
    Array.isArray(store[key]),
  )
}

export function loadDemoStore(): AppStore {
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isAppStore(parsed)) return parsed
    }
  } catch (err) {
    console.warn('Dados de demonstração inválidos no navegador; recriando.', err)
  }
  const fresh = buildDemoStore()
  saveDemoStore(fresh)
  return fresh
}

export function saveDemoStore(store: AppStore) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch (err) {
    console.warn('Não foi possível salvar os dados de demonstração.', err)
  }
}

export function resetDemoStore(): AppStore {
  const fresh = buildDemoStore()
  saveDemoStore(fresh)
  return fresh
}

export function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}
