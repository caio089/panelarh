import type { AppStore } from '@/lib/data'

/** Store vazio. Unidades, vagas e candidatos passam a existir só quando alguém cadastra. */
export function buildDemoStore(): AppStore {
  return {
    units: [],
    vagas: [],
    candidatos: [],
    profiles: [],
    experiences: [],
    messages: [],
  }
}
