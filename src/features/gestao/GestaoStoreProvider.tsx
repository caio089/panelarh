import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { sanitizeCollaboratorInput, validateCollaborator, type CollaboratorInput } from './collaboratorValidation'
import { GestaoStoreContext, type GestaoStoreValue } from './GestaoStoreContext'
import {
  buildInitialGestaoStore,
  GESTAO_STORAGE_KEY,
  loadGestaoStore,
  saveGestaoStore,
  type GestaoStore,
} from './storage'
import type { Colaborador } from './types'

/** Garante que nenhuma escrita passe sem validação, mesmo vinda de outro ponto do app. */
function assertValid(input: CollaboratorInput): CollaboratorInput {
  const errors = validateCollaborator(input)
  const firstError = Object.values(errors)[0]
  if (firstError) throw new Error(firstError)
  return sanitizeCollaboratorInput(input)
}

export function GestaoStoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<GestaoStore>(() => loadGestaoStore())

  useEffect(() => {
    saveGestaoStore(store)
  }, [store])

  // Sincroniza abas abertas do painel.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === GESTAO_STORAGE_KEY) setStore(loadGestaoStore())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const addColaborador = useCallback((unitId: string, input: CollaboratorInput) => {
    const clean = assertValid(input)
    const colaborador: Colaborador = {
      id: `colab-${crypto.randomUUID()}`,
      unitId,
      status: 'ativo',
      ...clean,
    }
    setStore((prev) => ({ ...prev, colaboradores: [...prev.colaboradores, colaborador] }))
    return colaborador
  }, [])

  const updateColaborador = useCallback((id: string, input: CollaboratorInput) => {
    const clean = assertValid(input)
    setStore((prev) => ({
      ...prev,
      colaboradores: prev.colaboradores.map((c) => (c.id === id ? { ...c, ...clean } : c)),
    }))
  }, [])

  const setColaboradorStatus = useCallback<GestaoStoreValue['setColaboradorStatus']>((id, status) => {
    setStore((prev) => ({
      ...prev,
      colaboradores: prev.colaboradores.map((c) => (c.id === id ? { ...c, status } : c)),
    }))
  }, [])

  const deleteColaborador = useCallback((id: string) => {
    setStore((prev) => ({
      colaboradores: prev.colaboradores.filter((c) => c.id !== id),
      // Remove a pessoa de todas as escalas salvas.
      escalas: prev.escalas.map((e) => {
        if (!(id in e.assignments)) return e
        const assignments = { ...e.assignments }
        delete assignments[id]
        return { ...e, assignments }
      }),
    }))
  }, [])

  const getEscala = useCallback<GestaoStoreValue['getEscala']>(
    (unitId, weekStart) => store.escalas.find((e) => e.unitId === unitId && e.weekStart === weekStart),
    [store.escalas],
  )

  const saveEscala = useCallback<GestaoStoreValue['saveEscala']>((unitId, weekStart, assignments, origem) => {
    setStore((prev) => {
      const others = prev.escalas.filter((e) => !(e.unitId === unitId && e.weekStart === weekStart))
      return {
        ...prev,
        escalas: [...others, { unitId, weekStart, assignments, origem, atualizadaEm: new Date().toISOString() }],
      }
    })
  }, [])

  const resetGestao = useCallback(() => setStore(buildInitialGestaoStore()), [])

  const value = useMemo<GestaoStoreValue>(
    () => ({
      colaboradores: store.colaboradores,
      escalas: store.escalas,
      addColaborador,
      updateColaborador,
      setColaboradorStatus,
      deleteColaborador,
      getEscala,
      saveEscala,
      resetGestao,
    }),
    [store, addColaborador, updateColaborador, setColaboradorStatus, deleteColaborador, getEscala, saveEscala, resetGestao],
  )

  return <GestaoStoreContext.Provider value={value}>{children}</GestaoStoreContext.Provider>
}
