import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CandidateStatus, Candidato, Unit, Vaga } from '@/types'
import type { AppStore } from '@/lib/data'
import { loadDemoStore, newId, resetDemoStore, saveDemoStore } from '@/lib/demo/storage'

type VagaEditableField =
  | 'titulo'
  | 'descricao'
  | 'localidade'
  | 'tipo'
  | 'ativa'
  | 'unit_id'
  | 'salario'
  | 'horario'
  | 'regime'
  | 'responsabilidades'
  | 'requisitos'
  | 'diferenciais'
  | 'beneficios'

interface NewVagaInput {
  unitId: string
  titulo: string
  descricao?: string
  localidade?: string
  tipo?: string
  ativa?: boolean
  salario?: string
  horario?: string
  regime?: string
  responsabilidades?: string
  requisitos?: string
  diferenciais?: string
  beneficios?: string
}

interface PublicApplicationInput {
  vagaId: string
  nome: string
  cpf: string
  phone: string
  city: string
  preferredUnit: string
  shifts: string
  weekendAvailability: string
  commute: string
  workedRestaurant: string
  experience: string
  dailyWork: string
  whyRole: string
  startWhen: string
}

interface DataContextValue {
  store: AppStore
  resetDemoData: () => void
  addVaga: (input: NewVagaInput) => Promise<string>
  updateVaga: (vagaId: string, patch: Partial<Pick<Vaga, VagaEditableField>>) => void
  deleteVaga: (vagaId: string) => void
  updateCandidatoStatus: (candidatoId: string, status: CandidateStatus, dataInicio?: string | null) => void
  finishVagaSelection: (
    vagaId: string,
    candidatoId: string,
  ) => { chosenName: string; parked: number } | { error: string }
  deleteCandidato: (candidatoId: string) => void
  submitPublicApplication: (input: PublicApplicationInput) => Promise<{ error?: string; candidatoId?: string }>
  sendMessage: (candidatoId: string, senderId: string, body: string) => void
  addUnit: (name: string) => Promise<string>
  updateUnit: (id: string, name: string) => Promise<void>
  deleteUnit: (id: string) => Promise<void>
  getVaga: (id: string) => (Vaga & { unitName?: string }) | undefined
  getCandidatosByVaga: (vagaId: string) => Candidato[]
}

const DataContext = createContext<DataContextValue | null>(null)

const DEFAULT_VAGA_DESCRICAO =
  'Oportunidade no time Panela Velha. Candidate-se e faça parte da nossa cozinha.'

function sortUnits(units: Unit[]) {
  return [...units].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

function unitNameTaken(units: Unit[], name: string, ignoreId?: string) {
  const normalized = name.toLowerCase()
  return units.some((u) => u.id !== ignoreId && u.name.toLowerCase() === normalized)
}

function oneLine(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function buildPublicApplicationInfo(input: PublicApplicationInput) {
  return [
    `WhatsApp: ${input.phone}`,
    `CPF: ${input.cpf}`,
    `Bairro: ${input.city}`,
    `Unidade: ${input.preferredUnit}`,
    `Turnos: ${input.shifts}`,
    `Fim de semana: ${input.weekendAvailability}`,
    `Como chega: ${input.commute}`,
    `Restaurante: ${input.workedRestaurant}`,
    `Último trabalho: ${oneLine(input.experience)}`,
    `No dia a dia: ${oneLine(input.dailyWork)}`,
    `Por que a vaga: ${oneLine(input.whyRole)}`,
    `Começa: ${input.startWhen}`,
  ].join('\n')
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AppStore>(() => loadDemoStore())

  useEffect(() => {
    saveDemoStore(store)
  }, [store])

  // Mantém abas abertas sincronizadas (ex.: site público em uma aba, painel RH em outra).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith('panela-demo-store')) setStore(loadDemoStore())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const resetDemoData = useCallback(() => {
    setStore(resetDemoStore())
  }, [])

  const addVaga = useCallback(async (input: NewVagaInput) => {
    if (!input.unitId) throw new Error('Selecione uma unidade.')
    if (!input.titulo.trim()) throw new Error('Informe o título da vaga.')

    const vaga: Vaga = {
      id: newId('vaga'),
      unit_id: input.unitId,
      titulo: input.titulo.trim(),
      descricao: input.descricao || DEFAULT_VAGA_DESCRICAO,
      localidade: input.localidade || 'Presencial',
      tipo: input.tipo || 'Presencial',
      ativa: input.ativa ?? true,
      criada_em: new Date().toISOString(),
      salario: input.salario || null,
      horario: input.horario || null,
      regime: input.regime || 'CLT',
      responsabilidades: input.responsabilidades || null,
      requisitos: input.requisitos || null,
      diferenciais: input.diferenciais || null,
      beneficios: input.beneficios || null,
    }
    setStore((prev) => ({ ...prev, vagas: [vaga, ...prev.vagas] }))
    return vaga.id
  }, [])

  const updateVaga = useCallback((vagaId: string, patch: Partial<Pick<Vaga, VagaEditableField>>) => {
    setStore((prev) => ({
      ...prev,
      vagas: prev.vagas.map((v) => (v.id === vagaId ? { ...v, ...patch } : v)),
    }))
  }, [])

  const deleteVaga = useCallback((vagaId: string) => {
    setStore((prev) => {
      const removedCandidatoIds = new Set(prev.candidatos.filter((c) => c.vaga_id === vagaId).map((c) => c.id))
      return {
        ...prev,
        vagas: prev.vagas.filter((v) => v.id !== vagaId),
        candidatos: prev.candidatos.filter((c) => c.vaga_id !== vagaId),
        messages: prev.messages.filter((m) => !removedCandidatoIds.has(m.candidato_id)),
      }
    })
  }, [])

  const updateCandidatoStatus = useCallback(
    (candidatoId: string, status: CandidateStatus, dataInicio?: string | null) => {
      const nextStatus: CandidateStatus = status === 'reprovada' ? 'banco' : status
      setStore((prev) => ({
        ...prev,
        candidatos: prev.candidatos.map((c) =>
          c.id === candidatoId
            ? {
                ...c,
                status: nextStatus,
                data_inicio_treinamento: nextStatus === 'aprovada' ? dataInicio || null : null,
              }
            : c,
        ),
      }))
    },
    [],
  )

  const finishVagaSelection = useCallback((vagaId: string, candidatoId: string) => {
    let result: { chosenName: string; parked: number } | { error: string } = {
      error: 'Não foi possível encerrar a seleção.',
    }
    setStore((prev) => {
      const vaga = prev.vagas.find((item) => item.id === vagaId)
      const chosen = prev.candidatos.find((item) => item.id === candidatoId && item.vaga_id === vagaId)
      if (!vaga || !chosen) {
        result = { error: 'Vaga ou candidato não encontrado.' }
        return prev
      }
      if (vaga.ativa === false) {
        result = { error: 'Esta vaga já está encerrada.' }
        return prev
      }
      let parked = 0
      const candidatos = prev.candidatos.map((item) => {
        if (item.vaga_id !== vagaId) return item
        if (item.id === candidatoId) {
          return { ...item, status: 'aprovada' as const, data_inicio_treinamento: null }
        }
        if (item.status === 'pendente' || item.status === 'entrevista') {
          parked += 1
          return { ...item, status: 'banco' as const, data_inicio_treinamento: null }
        }
        return item
      })
      result = { chosenName: chosen.nome, parked }
      return {
        ...prev,
        vagas: prev.vagas.map((item) => (item.id === vagaId ? { ...item, ativa: false } : item)),
        candidatos,
      }
    })
    return result
  }, [])

  const deleteCandidato = useCallback((candidatoId: string) => {
    setStore((prev) => ({
      ...prev,
      candidatos: prev.candidatos.filter((c) => c.id !== candidatoId),
      messages: prev.messages.filter((m) => m.candidato_id !== candidatoId),
    }))
  }, [])

  const submitPublicApplication = useCallback(
    async (input: PublicApplicationInput) => {
      if (!store.vagas.some((v) => v.id === input.vagaId && v.ativa !== false)) {
        return { error: 'Esta vaga não está mais disponível.' }
      }
      if (!input.nome.trim()) return { error: 'Informe seu nome.' }

      const candidato: Candidato = {
        id: newId('cand'),
        vaga_id: input.vagaId,
        profile_id: null,
        nome: input.nome.trim(),
        experiencia: input.experience || null,
        info_complementar: buildPublicApplicationInfo(input),
        referencia: null,
        status: 'pendente',
        data_inicio_treinamento: null,
        curriculo_url: null,
        curriculo_nome: null,
        criado_em: new Date().toISOString(),
      }
      setStore((prev) => ({ ...prev, candidatos: [candidato, ...prev.candidatos] }))
      return { candidatoId: candidato.id }
    },
    [store.vagas],
  )

  const sendMessage = useCallback((candidatoId: string, senderId: string, body: string) => {
    const trimmed = body.trim()
    if (!trimmed) return
    setStore((prev) => ({
      ...prev,
      messages: [
        {
          id: newId('msg'),
          candidato_id: candidatoId,
          sender_id: senderId,
          body: trimmed,
          created_at: new Date().toISOString(),
          read_at: null,
        },
        ...prev.messages,
      ],
    }))
  }, [])

  const addUnit = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Informe o nome da unidade.')
      if (unitNameTaken(store.units, trimmed)) throw new Error('Já existe uma unidade com esse nome.')

      const unit: Unit = { id: newId('unit'), name: trimmed }
      setStore((prev) => ({ ...prev, units: sortUnits([...prev.units, unit]) }))
      return unit.id
    },
    [store.units],
  )

  const updateUnit = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Informe o nome da unidade.')
      if (unitNameTaken(store.units, trimmed, id)) throw new Error('Já existe uma unidade com esse nome.')

      setStore((prev) => ({
        ...prev,
        units: sortUnits(prev.units.map((u) => (u.id === id ? { ...u, name: trimmed } : u))),
      }))
    },
    [store.units],
  )

  const deleteUnit = useCallback(async (id: string) => {
    setStore((prev) => {
      const removedVagaIds = new Set(prev.vagas.filter((v) => v.unit_id === id).map((v) => v.id))
      const removedCandidatoIds = new Set(
        prev.candidatos.filter((c) => removedVagaIds.has(c.vaga_id)).map((c) => c.id),
      )
      return {
        ...prev,
        units: prev.units.filter((u) => u.id !== id),
        vagas: prev.vagas.filter((v) => !removedVagaIds.has(v.id)),
        candidatos: prev.candidatos.filter((c) => !removedCandidatoIds.has(c.id)),
        messages: prev.messages.filter((m) => !removedCandidatoIds.has(m.candidato_id)),
      }
    })
  }, [])

  const getVaga = useCallback(
    (id: string) => {
      const vaga = store.vagas.find((v) => v.id === id)
      if (!vaga) return undefined
      const unit = store.units.find((u) => u.id === vaga.unit_id)
      return { ...vaga, unitName: unit?.name }
    },
    [store],
  )

  const getCandidatosByVaga = useCallback(
    (vagaId: string) => store.candidatos.filter((c) => c.vaga_id === vagaId),
    [store],
  )

  const value = useMemo(
    () => ({
      store,
      resetDemoData,
      addVaga,
      updateVaga,
      deleteVaga,
      updateCandidatoStatus,
      finishVagaSelection,
      deleteCandidato,
      submitPublicApplication,
      sendMessage,
      addUnit,
      updateUnit,
      deleteUnit,
      getVaga,
      getCandidatosByVaga,
    }),
    [
      store,
      resetDemoData,
      addVaga,
      updateVaga,
      deleteVaga,
      updateCandidatoStatus,
      finishVagaSelection,
      deleteCandidato,
      submitPublicApplication,
      sendMessage,
      addUnit,
      updateUnit,
      deleteUnit,
      getVaga,
      getCandidatosByVaga,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData deve ser usado dentro de DataProvider')
  return ctx
}
