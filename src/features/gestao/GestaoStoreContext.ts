import { createContext, useContext } from 'react'
import type { CollaboratorInput } from './collaboratorValidation'
import type { Colaborador, CollaboratorStatus, EscalaSemana, ScheduleAssignments } from './types'

export interface GestaoStoreValue {
  colaboradores: Colaborador[]
  escalas: EscalaSemana[]
  addColaborador: (unitId: string, input: CollaboratorInput) => Colaborador
  updateColaborador: (id: string, input: CollaboratorInput) => void
  setColaboradorStatus: (id: string, status: CollaboratorStatus) => void
  deleteColaborador: (id: string) => void
  getEscala: (unitId: string, weekStart: string) => EscalaSemana | undefined
  saveEscala: (unitId: string, weekStart: string, assignments: ScheduleAssignments, origem: EscalaSemana['origem']) => void
  resetGestao: () => void
}

export const GestaoStoreContext = createContext<GestaoStoreValue | null>(null)

export function useGestaoStore(): GestaoStoreValue {
  const ctx = useContext(GestaoStoreContext)
  if (!ctx) throw new Error('useGestaoStore deve ser usado dentro de GestaoStoreProvider')
  return ctx
}
