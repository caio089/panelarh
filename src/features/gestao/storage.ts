import type { Colaborador, EscalaSemana } from './types'

/**
 * Persistência local dos dados editáveis do painel de gestão.
 * Começa vazio: colaborador e escala só existem depois do cadastro.
 */

const STORAGE_KEY = 'panela-gestao-store-v3'
const LEGACY_STORAGE_KEYS = ['panela-gestao-store-v2']

export interface GestaoStore {
  colaboradores: Colaborador[]
  escalas: EscalaSemana[]
}

function isGestaoStore(value: unknown): value is GestaoStore {
  if (!value || typeof value !== 'object') return false
  const store = value as Record<string, unknown>
  return Array.isArray(store.colaboradores) && Array.isArray(store.escalas)
}

export function buildInitialGestaoStore(): GestaoStore {
  return {
    colaboradores: [],
    escalas: [],
  }
}

export function loadGestaoStore(): GestaoStore {
  try {
    for (const key of LEGACY_STORAGE_KEYS) window.localStorage.removeItem(key)
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isGestaoStore(parsed)) return parsed
    }
  } catch (err) {
    console.warn('Dados de gestão inválidos no navegador; recriando.', err)
  }
  return buildInitialGestaoStore()
}

export function saveGestaoStore(store: GestaoStore) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (err) {
    console.warn('Não foi possível salvar os dados de gestão.', err)
  }
}

export const GESTAO_STORAGE_KEY = STORAGE_KEY
