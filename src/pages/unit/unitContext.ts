import { useOutletContext } from 'react-router-dom'
import type { AdminUnitPerson } from '@/lib/adminPeopleDb'

export interface UnitOutletContext {
  unitId: string
  unitName: string
  collaborators: AdminUnitPerson[]
  collaboratorsLoading: boolean
  collaboratorsError: string
  reloadCollaborators: () => Promise<void>
}

/** Dados da unidade atual, fornecidos pelo `UnitLayout` às abas. */
export function useUnitContext(): UnitOutletContext {
  return useOutletContext<UnitOutletContext>()
}
