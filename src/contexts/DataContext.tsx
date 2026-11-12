import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { CandidateStatus, Candidato, Unit, Vaga } from '@/types'
import type { AppStore } from '@/lib/data'
import {
  candidatoIdentity,
  deleteRemoteCandidato,
  insertCandidato,
  listCandidatos,
  updateRemoteCandidato,
} from '@/lib/candidatosDb'
import { isCompleteCpf } from '@/lib/applicationForm'
import { loadDemoStore, newId, resetDemoStore, saveDemoStore } from '@/lib/demo/storage'
import { deleteRemoteVaga, insertVaga, listVagas, updateRemoteVaga } from '@/lib/vagasDb'

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
  age: string
  preferredUnit: string
  shifts: string
  weekendAvailability: string
  commute: string
  holidays: string
  workedRestaurant: string
  roles: string
  experience: string
  dailyWork: string
  whyRole: string
  startWhen: string
  workCard: string
  source: string
  standing: string
  restriction: string
  curriculoUrl?: string | null
  curriculoNome?: string | null
}

interface DataContextValue {
  store: AppStore
  sharedReady: boolean
  vagasError: string
  candidatosError: string
  resetDemoData: () => void
  addVaga: (input: NewVagaInput) => Promise<string>
  updateVaga: (vagaId: string, patch: Partial<Pick<Vaga, VagaEditableField>>) => Promise<void>
  deleteVaga: (vagaId: string) => Promise<void>
  updateCandidatoStatus: (candidatoId: string, status: CandidateStatus, dataInicio?: string | null) => void
  finishVagaSelection: (
    vagaId: string,
    candidatoId: string,
  ) => { chosenName: string; parked: number } | { error: string }
  deleteCandidato: (candidatoId: string) => Promise<void>
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

function optionalLine(label: string, value: string) {
  const text = oneLine(value)
  return text ? `${label}: ${text}` : ''
}

function buildPublicApplicationInfo(input: PublicApplicationInput) {
  return [
    `WhatsApp: ${input.phone}`,
    `CPF: ${input.cpf}`,
    `Bairro: ${input.city}`,
    optionalLine('Idade', input.age),
    `Unidade: ${input.preferredUnit}`,
    `Turnos: ${input.shifts}`,
    `Fim de semana: ${input.weekendAvailability}`,
    `Como chega: ${input.commute}`,
    optionalLine('Feriados', input.holidays),
    `Restaurante: ${input.workedRestaurant}`,
    optionalLine('Funções', input.roles),
    `Último trabalho: ${oneLine(input.experience)}`,
    `No dia a dia: ${oneLine(input.dailyWork)}`,
    `Por que a vaga: ${oneLine(input.whyRole)}`,
    `Começa: ${input.startWhen}`,
    optionalLine('Carteira de trabalho', input.workCard),
    optionalLine('Como soube', input.source),
    optionalLine('Fica em pé', input.standing),
    optionalLine('Restrição de horário', input.restriction),
  ]
    .filter(Boolean)
    .join('\n')
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AppStore>(() => loadDemoStore())
  const [sharedReady, setSharedReady] = useState(false)
  const [vagasError, setVagasError] = useState('')
  const [candidatosError, setCandidatosError] = useState('')
  const vagaWrite = useRef(0)
  const candidatoWrite = useRef(0)

  useEffect(() => {
    saveDemoStore(store)
  }, [store])

  const pullShared = useCallback(async () => {
    const seenVagas = vagaWrite.current
    const seenCandidatos = candidatoWrite.current
    try {
      const [vagas, listed] = await Promise.all([listVagas(), listCandidatos()])
      if (seenVagas !== vagaWrite.current || seenCandidatos !== candidatoWrite.current) return

      const candidatos = listed
        .filter((candidato, index, all) => all.findIndex((item) => candidatoIdentity(item) === candidatoIdentity(candidato)) === index)
        .sort((a, b) => +new Date(b.criado_em) - +new Date(a.criado_em))

      setVagasError('')
      setCandidatosError('')
      setStore((prev) => ({ ...prev, vagas, candidatos }))
    } catch (err) {
      if (seenVagas !== vagaWrite.current || seenCandidatos !== candidatoWrite.current) return
      const message = err instanceof Error ? err.message : 'Não foi possível carregar o painel.'
      if (message.includes('candidat')) setCandidatosError(message)
      else setVagasError(message)
    } finally {
      setSharedReady(true)
    }
  }, [])

  useEffect(() => {
    void pullShared()
    const onFocus = () => {
      void pullShared()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [pullShared])

  // Outra aba no mesmo navegador pede a lista do banco de novo.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key?.startsWith('panela-demo-store')) return
      void pullShared()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [pullShared])

  const resetDemoData = useCallback(() => {
    setStore(resetDemoStore())
  }, [])

  const addVaga = useCallback(async (input: NewVagaInput) => {
    if (!input.unitId) throw new Error('Selecione uma unidade.')
    if (!input.titulo.trim()) throw new Error('Informe o título da vaga.')

    vagaWrite.current += 1
    const vaga = await insertVaga({
      unit_id: input.unitId,
      titulo: input.titulo.trim(),
      descricao: input.descricao || DEFAULT_VAGA_DESCRICAO,
      localidade: input.localidade || 'Presencial',
      tipo: input.tipo || 'Presencial',
      ativa: input.ativa ?? true,
      salario: input.salario || null,
      horario: input.horario || null,
      regime: input.regime || 'CLT',
      responsabilidades: input.responsabilidades || null,
      requisitos: input.requisitos || null,
      diferenciais: input.diferenciais || null,
      beneficios: input.beneficios || null,
    })
    vagaWrite.current += 1
    setStore((prev) => ({ ...prev, vagas: [vaga, ...prev.vagas.filter((item) => item.id !== vaga.id)] }))
    return vaga.id
  }, [])

  const updateVaga = useCallback(async (vagaId: string, patch: Partial<Pick<Vaga, VagaEditableField>>) => {
    vagaWrite.current += 1
    await updateRemoteVaga(vagaId, patch)
    vagaWrite.current += 1
    setStore((prev) => ({
      ...prev,
      vagas: prev.vagas.map((v) => (v.id === vagaId ? { ...v, ...patch } : v)),
    }))
  }, [])

  const deleteVaga = useCallback(async (vagaId: string) => {
    vagaWrite.current += 1
    candidatoWrite.current += 1
    await deleteRemoteVaga(vagaId)
    vagaWrite.current += 1
    candidatoWrite.current += 1
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
      const trainingDate = nextStatus === 'aprovada' ? dataInicio || null : null
      candidatoWrite.current += 1
      setStore((prev) => ({
        ...prev,
        candidatos: prev.candidatos.map((c) =>
          c.id === candidatoId
            ? { ...c, status: nextStatus, data_inicio_treinamento: trainingDate }
            : c,
        ),
      }))
      void updateRemoteCandidato(candidatoId, {
        status: nextStatus,
        data_inicio_treinamento: trainingDate,
      }).catch((err: unknown) => {
        setCandidatosError(err instanceof Error ? err.message : 'Não foi possível atualizar o candidato.')
      })
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
    if ('chosenName' in result) {
      vagaWrite.current += 1
      candidatoWrite.current += 1
      void updateRemoteVaga(vagaId, { ativa: false }).catch(() => {
        setVagasError('A vaga foi encerrada neste navegador, mas o site ainda não confirmou.')
      })
      const chosen = store.candidatos.find((item) => item.id === candidatoId)
      const parked = store.candidatos.filter(
        (item) =>
          item.vaga_id === vagaId &&
          item.id !== candidatoId &&
          (item.status === 'pendente' || item.status === 'entrevista'),
      )
      void Promise.all([
        updateRemoteCandidato(candidatoId, {
          status: 'aprovada',
          data_inicio_treinamento: chosen?.data_inicio_treinamento ?? null,
        }),
        ...parked.map((item) =>
          updateRemoteCandidato(item.id, { status: 'banco', data_inicio_treinamento: null }),
        ),
      ]).catch(() => {
        setCandidatosError('A seleção mudou neste navegador, mas o outro painel ainda não confirmou.')
      })
    }
    return result
  }, [store.candidatos])

  const deleteCandidato = useCallback(async (candidatoId: string) => {
    const target = store.candidatos.find((candidato) => candidato.id === candidatoId)
    const identity = target ? candidatoIdentity(target) : ''
    candidatoWrite.current += 1
    try {
      await deleteRemoteCandidato(candidatoId)
      setCandidatosError('')
      setStore((prev) => {
        const next = {
          ...prev,
          candidatos: prev.candidatos.filter((candidato) => {
            if (candidato.id === candidatoId) return false
            return !(identity && candidatoIdentity(candidato) === identity)
          }),
          messages: prev.messages.filter((message) => message.candidato_id !== candidatoId),
        }
        saveDemoStore(next)
        return next
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível excluir o candidato.'
      setCandidatosError(message)
      throw err instanceof Error ? err : new Error(message)
    }
  }, [store.candidatos])

  const submitPublicApplication = useCallback(
    async (input: PublicApplicationInput) => {
      if (!store.vagas.some((v) => v.id === input.vagaId && v.ativa !== false)) {
        return { error: 'Esta vaga não está mais disponível.' }
      }
      if (input.nome.trim().length < 2) return { error: 'Informe seu nome.' }
      if (!isCompleteCpf(input.cpf)) return { error: 'Informe um CPF válido.' }

      candidatoWrite.current += 1
      try {
        const candidato = await insertCandidato({
          vagaId: input.vagaId,
          nome: input.nome,
          cpf: input.cpf,
          experiencia: input.experience || null,
          info: buildPublicApplicationInfo(input),
          curriculoUrl: input.curriculoUrl || null,
          curriculoNome: input.curriculoNome || null,
        })
        candidatoWrite.current += 1
        setCandidatosError('')
        setStore((prev) => ({
          ...prev,
          candidatos: [candidato, ...prev.candidatos.filter((item) => item.id !== candidato.id)],
        }))
        return { candidatoId: candidato.id }
      } catch (err) {
        candidatoWrite.current += 1
        const message = err instanceof Error ? err.message : 'Não foi possível registrar a candidatura.'
        return { error: message }
      }
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
      sharedReady,
      vagasError,
      candidatosError,
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
      sharedReady,
      vagasError,
      candidatosError,
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
