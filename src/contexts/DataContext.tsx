import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CandidateStatus, Candidato, Experience, Message, Profile, Vaga } from '@/types'
import { createInitialStore, type MockStore, UNIT_CENTRO } from '@/lib/mockData'
import { uid } from '@/lib/utils'
import { api, pingApi } from '@/lib/api'

const STORAGE_KEY = 'panela_rh_mock_store_v2'
const USE_SQLITE = import.meta.env.VITE_USE_SQLITE === 'true'

interface DataContextValue {
  store: MockStore
  sqliteMode: boolean
  refreshStore: () => Promise<void>
  resetStore: () => void
  addVaga: (input: {
    unitId: string
    titulo: string
    descricao?: string
    localidade?: string
    tipo?: string
    ativa?: boolean
  }) => string
  updateVaga: (
    vagaId: string,
    patch: Partial<Pick<Vaga, 'titulo' | 'descricao' | 'localidade' | 'tipo' | 'ativa' | 'unit_id'>>,
  ) => void
  deleteVaga: (vagaId: string) => void
  updateCandidatoStatus: (
    candidatoId: string,
    status: CandidateStatus,
    dataInicio?: string | null,
  ) => void
  deleteCandidato: (candidatoId: string) => void
  upsertProfile: (profile: Profile) => void
  replaceExperiences: (profileId: string, experiences: Experience[]) => void
  applyToVaga: (input: {
    vagaId: string
    profile: Profile
    experiences?: Experience[]
    nome?: string
    experiencia?: string | null
    info?: string | null
  }) => Promise<{ error?: string; candidatoId?: string }>
  sendMessage: (candidatoId: string, senderId: string, body: string) => void
  getVaga: (id: string) => (Vaga & { unitName?: string }) | undefined
  getCandidatosByVaga: (vagaId: string) => Candidato[]
  getMessagesForProfile: (profileId: string) => Message[]
}

const DataContext = createContext<DataContextValue | null>(null)

function loadStore(): MockStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as MockStore
  } catch {
    /* ignore */
  }
  return createInitialStore()
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<MockStore>(() => createInitialStore())
  const [sqliteMode, setSqliteMode] = useState(false)

  const refreshStore = useCallback(async () => {
    if (!USE_SQLITE) return
    try {
      const online = await pingApi()
      if (!online) {
        setSqliteMode(false)
        return
      }
      const data = await api<MockStore>('/api/store')
      setStore(data)
      setSqliteMode(true)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (err) {
      console.error(err)
      setSqliteMode(false)
    }
  }, [])

  useEffect(() => {
    if (USE_SQLITE) {
      void refreshStore()
    } else {
      setStore(loadStore())
    }
  }, [refreshStore])

  useEffect(() => {
    if (!sqliteMode) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    }
  }, [store, sqliteMode])

  const resetStore = useCallback(() => {
    if (sqliteMode) {
      void refreshStore()
      return
    }
    const fresh = createInitialStore()
    setStore(fresh)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  }, [sqliteMode, refreshStore])

  const addVaga = useCallback(
    (input: {
      unitId: string
      titulo: string
      descricao?: string
      localidade?: string
      tipo?: string
      ativa?: boolean
    }) => {
      const id = uid()
      if (USE_SQLITE && sqliteMode) {
        void api('/api/vagas', {
          method: 'POST',
          json: {
            unit_id: input.unitId || UNIT_CENTRO,
            titulo: input.titulo,
            descricao: input.descricao,
            localidade: input.localidade,
            tipo: input.tipo,
            ativa: input.ativa ?? true,
          },
        }).then(() => refreshStore())
        return id
      }
      setStore((prev) => ({
        ...prev,
        vagas: [
          {
            id,
            unit_id: input.unitId || UNIT_CENTRO,
            titulo: input.titulo,
            descricao:
              input.descricao ||
              'Oportunidade no time Panela Velha. Candidate-se e faça parte da nossa cozinha.',
            localidade: input.localidade || 'Presencial',
            tipo: input.tipo || 'Presencial',
            ativa: input.ativa ?? true,
            criada_em: new Date().toISOString(),
          },
          ...prev.vagas,
        ],
      }))
      return id
    },
    [sqliteMode, refreshStore],
  )

  const updateVaga = useCallback(
    (
      vagaId: string,
      patch: Partial<Pick<Vaga, 'titulo' | 'descricao' | 'localidade' | 'tipo' | 'ativa' | 'unit_id'>>,
    ) => {
      if (USE_SQLITE && sqliteMode) {
        void api(`/api/vagas/${vagaId}`, { method: 'PATCH', json: patch }).then(() => refreshStore())
        return
      }
      setStore((prev) => ({
        ...prev,
        vagas: prev.vagas.map((v) => (v.id === vagaId ? { ...v, ...patch } : v)),
      }))
    },
    [sqliteMode, refreshStore],
  )

  const deleteVaga = useCallback(
    (vagaId: string) => {
      if (USE_SQLITE && sqliteMode) {
        void api(`/api/vagas/${vagaId}`, { method: 'DELETE' }).then(() => refreshStore())
        return
      }
      setStore((prev) => ({
        ...prev,
        vagas: prev.vagas.filter((v) => v.id !== vagaId),
        candidatos: prev.candidatos.filter((c) => c.vaga_id !== vagaId),
        messages: prev.messages.filter(
          (m) => !prev.candidatos.some((c) => c.id === m.candidato_id && c.vaga_id === vagaId),
        ),
      }))
    },
    [sqliteMode, refreshStore],
  )

  const updateCandidatoStatus = useCallback(
    (candidatoId: string, status: CandidateStatus, dataInicio?: string | null) => {
      if (USE_SQLITE && sqliteMode) {
        void api(`/api/candidatos/${candidatoId}/status`, {
          method: 'PATCH',
          json: { status, data_inicio_treinamento: dataInicio },
        }).then(() => refreshStore())
        return
      }
      setStore((prev) => ({
        ...prev,
        candidatos: prev.candidatos.map((c) =>
          c.id === candidatoId
            ? {
                ...c,
                status,
                data_inicio_treinamento: status === 'aprovada' ? dataInicio || null : null,
              }
            : c,
        ),
      }))
    },
    [sqliteMode, refreshStore],
  )

  const deleteCandidato = useCallback((candidatoId: string) => {
    setStore((prev) => ({
      ...prev,
      candidatos: prev.candidatos.filter((c) => c.id !== candidatoId),
      messages: prev.messages.filter((m) => m.candidato_id !== candidatoId),
    }))
  }, [])

  const upsertProfile = useCallback(
    (profile: Profile) => {
      if (USE_SQLITE && sqliteMode) {
        void api('/api/profile', { method: 'PATCH', json: profile }).then(() => refreshStore())
      }
      setStore((prev) => {
        const exists = prev.profiles.some((p) => p.id === profile.id)
        return {
          ...prev,
          profiles: exists
            ? prev.profiles.map((p) => (p.id === profile.id ? { ...p, ...profile } : p))
            : [profile, ...prev.profiles],
        }
      })
    },
    [sqliteMode, refreshStore],
  )

  const replaceExperiences = useCallback(
    (profileId: string, experiences: Experience[]) => {
      if (USE_SQLITE && sqliteMode) {
        void api('/api/profile/experiences', {
          method: 'PUT',
          json: { experiences },
        }).then(() => refreshStore())
      }
      setStore((prev) => ({
        ...prev,
        experiences: [
          ...prev.experiences.filter((e) => e.profile_id !== profileId),
          ...experiences.map((e) => ({ ...e, profile_id: profileId })),
        ],
      }))
    },
    [sqliteMode, refreshStore],
  )

  const applyToVaga = useCallback(
    async (input: {
      vagaId: string
      profile: Profile
      experiences?: Experience[]
      nome?: string
      experiencia?: string | null
      info?: string | null
    }) => {
      if (USE_SQLITE && sqliteMode) {
        const exists = store.candidatos.some(
          (c) => c.vaga_id === input.vagaId && c.profile_id === input.profile.id,
        )
        if (exists) return { error: 'Você já se candidatou a esta vaga.' }

        try {
          await api('/api/profile', { method: 'PATCH', json: input.profile })
          if (input.experiences) {
            await api('/api/profile/experiences', {
              method: 'PUT',
              json: { experiences: input.experiences },
            })
          }
          const created = await api<{ id: string }>('/api/candidaturas', {
            method: 'POST',
            json: {
              vaga_id: input.vagaId,
              nome: input.nome,
              experiencia: input.experiencia,
              info_complementar: input.info,
            },
          })
          await refreshStore()
          return { candidatoId: created.id }
        } catch (e) {
          return { error: e instanceof Error ? e.message : 'Erro ao candidatar' }
        }
      }

      let error: string | undefined
      let candidatoId: string | undefined

      setStore((prev) => {
        const exists = prev.candidatos.some(
          (c) => c.vaga_id === input.vagaId && c.profile_id === input.profile.id,
        )
        if (exists) {
          error = 'Você já se candidatou a esta vaga.'
          return prev
        }

        const profiles = prev.profiles.some((p) => p.id === input.profile.id)
          ? prev.profiles.map((p) => (p.id === input.profile.id ? { ...p, ...input.profile } : p))
          : [input.profile, ...prev.profiles]

        const experiences = input.experiences
          ? [
              ...prev.experiences.filter((e) => e.profile_id !== input.profile.id),
              ...input.experiences.map((e) => ({ ...e, profile_id: input.profile.id })),
            ]
          : prev.experiences

        candidatoId = uid()
        return {
          ...prev,
          profiles,
          experiences,
          candidatos: [
            {
              id: candidatoId,
              vaga_id: input.vagaId,
              profile_id: input.profile.id,
              nome: input.nome || input.profile.full_name || input.profile.email || 'Candidato',
              experiencia: input.experiencia || null,
              info_complementar: input.info || null,
              referencia: null,
              status: 'pendente' as const,
              data_inicio_treinamento: null,
              curriculo_url: null,
              curriculo_nome: null,
              criado_em: new Date().toISOString(),
            },
            ...prev.candidatos,
          ],
        }
      })
      return { error, candidatoId }
    },
    [sqliteMode, refreshStore, store.candidatos],
  )

  const sendMessage = useCallback(
    (candidatoId: string, senderId: string, body: string) => {
      if (USE_SQLITE && sqliteMode) {
        void api('/api/messages', {
          method: 'POST',
          json: { candidato_id: candidatoId, body },
        }).then(() => refreshStore())
        return
      }
      setStore((prev) => ({
        ...prev,
        messages: [
          {
            id: uid(),
            candidato_id: candidatoId,
            sender_id: senderId,
            body,
            created_at: new Date().toISOString(),
            read_at: null,
          },
          ...prev.messages,
        ],
      }))
    },
    [sqliteMode, refreshStore],
  )

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

  const getMessagesForProfile = useCallback(
    (profileId: string) => {
      const candIds = store.candidatos.filter((c) => c.profile_id === profileId).map((c) => c.id)
      return store.messages.filter((m) => candIds.includes(m.candidato_id))
    },
    [store],
  )

  const value = useMemo(
    () => ({
      store,
      sqliteMode,
      refreshStore,
      resetStore,
      addVaga,
      updateVaga,
      deleteVaga,
      updateCandidatoStatus,
      deleteCandidato,
      upsertProfile,
      replaceExperiences,
      applyToVaga,
      sendMessage,
      getVaga,
      getCandidatosByVaga,
      getMessagesForProfile,
    }),
    [
      store,
      sqliteMode,
      refreshStore,
      resetStore,
      addVaga,
      updateVaga,
      deleteVaga,
      updateCandidatoStatus,
      deleteCandidato,
      upsertProfile,
      replaceExperiences,
      applyToVaga,
      sendMessage,
      getVaga,
      getCandidatosByVaga,
      getMessagesForProfile,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData deve ser usado dentro de DataProvider')
  return ctx
}
