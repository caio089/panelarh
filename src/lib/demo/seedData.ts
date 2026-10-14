import type { AppStore } from '@/lib/data'
import type { Unit } from '@/types'

/** Casas da rede. Ids estáveis para o painel reconhecer a mesma unidade. */
export const HOUSE_UNITS: Unit[] = [
  { id: 'unit-dirceu', name: 'Dirceu' },
  { id: 'unit-promorar', name: 'Promorar' },
  { id: 'unit-mocambinho', name: 'Mocambinho' },
]

export function withHouseUnits(units: Unit[]): Unit[] {
  const names = new Set(units.map((unit) => unit.name.trim().toLowerCase()))
  const missing = HOUSE_UNITS.filter((unit) => !names.has(unit.name.toLowerCase()))
  if (missing.length === 0) return units
  return [...units, ...missing].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/** Store inicial. As três unidades já nascem cadastradas; vagas e pessoas, não. */
export function buildDemoStore(): AppStore {
  return {
    units: withHouseUnits([]),
    vagas: [],
    candidatos: [],
    profiles: [],
    experiences: [],
    messages: [],
  }
}
