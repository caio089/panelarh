import { useOutletContext } from 'react-router-dom'

export interface UnitOutletContext {
  unitId: string
  unitName: string
}

/** Dados da unidade atual, fornecidos pelo `UnitLayout` às abas. */
export function useUnitContext(): UnitOutletContext {
  return useOutletContext<UnitOutletContext>()
}
