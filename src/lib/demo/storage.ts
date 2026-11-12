import type { AppStore } from '@/lib/data'
import { buildDemoStore, withHouseUnits } from '@/lib/demo/seedData'

/** Só o que é local deste navegador. Vagas e candidatos vivem no banco. */
const STORE_KEY = 'panela-local-store-v4'

function isLocalSlice(value: unknown): value is Pick<AppStore, 'units' | 'profiles' | 'experiences' | 'messages'> {
  if (!value || typeof value !== 'object') return false
  const store = value as Record<string, unknown>
  return ['units', 'profiles', 'experiences', 'messages'].every((key) => Array.isArray(store[key]))
}

function withoutSharedTables(store: AppStore): AppStore {
  return {
    units: store.units,
    vagas: [],
    candidatos: [],
    profiles: store.profiles,
    experiences: store.experiences,
    messages: store.messages,
  }
}

export function loadDemoStore(): AppStore {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('panela-demo-store')) window.localStorage.removeItem(key)
    }
    const raw = window.localStorage.getItem(STORE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isLocalSlice(parsed)) {
        const next = withoutSharedTables({
          ...buildDemoStore(),
          units: withHouseUnits(parsed.units),
          profiles: parsed.profiles,
          experiences: parsed.experiences,
          messages: parsed.messages,
        })
        saveDemoStore(next)
        return next
      }
    }
  } catch (err) {
    console.warn('Dados locais inválidos no navegador; recriando.', err)
  }
  const fresh = buildDemoStore()
  saveDemoStore(fresh)
  return fresh
}

export function saveDemoStore(store: AppStore) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(withoutSharedTables(store)))
  } catch (err) {
    console.warn('Não foi possível salvar os dados locais.', err)
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
