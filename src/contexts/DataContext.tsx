import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CandidateStatus, Candidato, Experience, Message, Profile, Unit, Vaga } from '@/types'
import { emptyStore, type AppStore } from '@/lib/data'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

interface DataContextValue {
  store: AppStore
  refreshStore: () => Promise<void>
  addVaga: (input: {
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
  }) => Promise<string>
  updateVaga: (
    vagaId: string,
    patch: Partial<
      Pick<
        Vaga,
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
      >
    >,
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
  submitPublicApplication: (input: {
    vagaId: string
    nome: string
    cpf: string
    phone: string
    city: string
    preferredUnit: string
    shifts: string
    weekendAvailability: string
    hasTransport: string
    aboutMe: string
    experience: string
    whyCompany: string
    disc: { D: number; I: number; S: number; C: number }
  }) => Promise<{ error?: string; candidatoId?: string }>
  sendMessage: (candidatoId: string, senderId: string, body: string) => void
  addUnit: (name: string) => Promise<string>
  updateUnit: (id: string, name: string) => Promise<void>
  deleteUnit: (id: string) => Promise<void>
  getVaga: (id: string) => (Vaga & { unitName?: string }) | undefined
  getCandidatosByVaga: (vagaId: string) => Candidato[]
  getMessagesForProfile: (profileId: string) => Message[]
}

const DataContext = createContext<DataContextValue | null>(null)

async function fetchStore(): Promise<AppStore> {
  const [unitsRes, vagasRes, candidatosRes, profilesRes, experiencesRes, messagesRes] =
    await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('vagas').select('*').order('criada_em', { ascending: false }),
      supabase.from('candidatos').select('*').order('criado_em', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('experiences').select('*'),
      supabase.from('messages').select('*').order('created_at', { ascending: false }),
    ])

  if (unitsRes.error) console.error('units:', unitsRes.error.message)
  if (vagasRes.error) console.error('vagas:', vagasRes.error.message)
  if (candidatosRes.error) console.error('candidatos:', candidatosRes.error.message)
  if (profilesRes.error) console.error('profiles:', profilesRes.error.message)
  if (experiencesRes.error) console.error('experiences:', experiencesRes.error.message)
  if (messagesRes.error) console.error('messages:', messagesRes.error.message)

  return {
    units: unitsRes.data ?? [],
    vagas: (vagasRes.data ?? []) as Vaga[],
    candidatos: (candidatosRes.data ?? []) as Candidato[],
    profiles: (profilesRes.data ?? []) as Profile[],
    experiences: (experiencesRes.data ?? []) as Experience[],
    messages: (messagesRes.data ?? []) as Message[],
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AppStore>(() => emptyStore())

  const refreshStore = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    try {
      setStore(await fetchStore())
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    void refreshStore()

    let timer: number | undefined
    const bump = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void refreshStore(), 200)
    }

    const channel = supabase
      .channel('panela-store')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vagas' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatos' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, bump)
      .subscribe()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshStore()
    })

    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshStore()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      window.clearTimeout(timer)
      void supabase.removeChannel(channel)
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refreshStore])

  const addVaga = useCallback(
    async (input: {
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
    }) => {
      if (!input.unitId) throw new Error('Selecione uma unidade.')
      const { data, error } = await supabase
        .from('vagas')
        .insert({
          unit_id: input.unitId,
          titulo: input.titulo,
          descricao:
            input.descricao ||
            'Oportunidade no time Panela Velha. Candidate-se e faça parte da nossa cozinha.',
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
        .select('*')
        .single()

      if (error || !data) {
        throw new Error(error?.message || 'Não foi possível criar a vaga. Entre no painel com uma conta de RH.')
      }

      setStore((prev) => ({ ...prev, vagas: [data as Vaga, ...prev.vagas.filter((v) => v.id !== data.id)] }))
      await refreshStore()
      return data.id as string
    },
    [refreshStore],
  )

  const updateVaga = useCallback(
    (
      vagaId: string,
      patch: Partial<
        Pick<
          Vaga,
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
        >
      >,
    ) => {
      void supabase
        .from('vagas')
        .update(patch)
        .eq('id', vagaId)
        .then(({ error }) => {
          if (error) console.error(error.message)
          void refreshStore()
        })
    },
    [refreshStore],
  )

  const deleteVaga = useCallback(
    (vagaId: string) => {
      void supabase
        .from('vagas')
        .delete()
        .eq('id', vagaId)
        .then(({ error }) => {
          if (error) console.error(error.message)
          void refreshStore()
        })
    },
    [refreshStore],
  )

  const updateCandidatoStatus = useCallback(
    (candidatoId: string, status: CandidateStatus, dataInicio?: string | null) => {
      void supabase
        .from('candidatos')
        .update({
          status,
          data_inicio_treinamento: status === 'aprovada' ? dataInicio || null : null,
        })
        .eq('id', candidatoId)
        .then(({ error }) => {
          if (error) console.error(error.message)
          void refreshStore()
        })
    },
    [refreshStore],
  )

  const deleteCandidato = useCallback(
    (candidatoId: string) => {
      void supabase
        .from('candidatos')
        .delete()
        .eq('id', candidatoId)
        .then(({ error }) => {
          if (error) console.error(error.message)
          void refreshStore()
        })
    },
    [refreshStore],
  )

  const upsertProfile = useCallback(
    (profile: Profile) => {
      void supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          cpf: profile.cpf,
          city: profile.city,
          birth_date: profile.birth_date,
          desired_role: profile.desired_role,
          availability: profile.availability,
          salary_expectation: profile.salary_expectation,
          linkedin: profile.linkedin,
          disc_d: profile.disc_d,
          disc_i: profile.disc_i,
          disc_s: profile.disc_s,
          disc_c: profile.disc_c,
          onboarding_completed: profile.onboarding_completed,
          unit_id: profile.unit_id,
          about_me: profile.about_me,
          weekend_availability: profile.weekend_availability,
          shifts: profile.shifts,
          preferred_unit: profile.preferred_unit,
          relevant_experience: profile.relevant_experience,
          why_company: profile.why_company,
          has_transport: profile.has_transport,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
        .then(({ error }) => {
          if (error) console.error(error.message)
          void refreshStore()
        })

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
    [refreshStore],
  )

  const replaceExperiences = useCallback(
    (profileId: string, experiences: Experience[]) => {
      void (async () => {
        const { error: delErr } = await supabase.from('experiences').delete().eq('profile_id', profileId)
        if (delErr) {
          console.error(delErr.message)
          return
        }
        const rows = experiences
          .filter((e) => e.company.trim() && e.role_title.trim())
          .map((e) => ({
            profile_id: profileId,
            company: e.company,
            role_title: e.role_title,
            start_date: e.start_date,
            end_date: e.end_date,
            description: e.description,
          }))
        if (rows.length) {
          const { error } = await supabase.from('experiences').insert(rows)
          if (error) console.error(error.message)
        }
        await refreshStore()
      })()

      setStore((prev) => ({
        ...prev,
        experiences: [
          ...prev.experiences.filter((e) => e.profile_id !== profileId),
          ...experiences.map((e) => ({ ...e, profile_id: profileId })),
        ],
      }))
    },
    [refreshStore],
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
      const exists = store.candidatos.some(
        (c) => c.vaga_id === input.vagaId && c.profile_id === input.profile.id,
      )
      if (exists) return { error: 'Você já se candidatou a esta vaga.' }

      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          full_name: input.profile.full_name,
          phone: input.profile.phone,
          desired_role: input.profile.desired_role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.profile.id)
      if (pErr) return { error: pErr.message }

      if (input.experiences?.length) {
        await supabase.from('experiences').delete().eq('profile_id', input.profile.id)
        const rows = input.experiences
          .filter((e) => e.company.trim() && e.role_title.trim())
          .map((e) => ({
            profile_id: input.profile.id,
            company: e.company,
            role_title: e.role_title,
            start_date: e.start_date,
            end_date: e.end_date,
            description: e.description,
          }))
        if (rows.length) {
          const { error } = await supabase.from('experiences').insert(rows)
          if (error) return { error: error.message }
        }
      }

      const { data, error } = await supabase
        .from('candidatos')
        .insert({
          vaga_id: input.vagaId,
          profile_id: input.profile.id,
          nome: input.nome || input.profile.full_name || input.profile.email || 'Candidato',
          experiencia: input.experiencia || null,
          info_complementar: input.info || null,
          status: 'pendente',
        })
        .select('id')
        .single()

      if (error) return { error: error.message }
      await refreshStore()
      return { candidatoId: data.id }
    },
    [refreshStore, store.candidatos],
  )

  const submitPublicApplication = useCallback(
    async (input: {
      vagaId: string
      nome: string
      cpf: string
      phone: string
      city: string
      preferredUnit: string
      shifts: string
      weekendAvailability: string
      hasTransport: string
      aboutMe: string
      experience: string
      whyCompany: string
      disc: { D: number; I: number; S: number; C: number }
    }) => {
      const info = [
        `WhatsApp: ${input.phone}`,
        `CPF: ${input.cpf}`,
        `Bairro: ${input.city}`,
        `Unidade: ${input.preferredUnit}`,
        `Turnos: ${input.shifts}`,
        `FDS: ${input.weekendAvailability}`,
        `Transporte: ${input.hasTransport}`,
        `Sobre: ${input.aboutMe}`,
        `Motivação: ${input.whyCompany}`,
        `DISC D${input.disc.D} I${input.disc.I} S${input.disc.S} C${input.disc.C}`,
      ].join('\n')

      const { data, error } = await supabase
        .from('candidatos')
        .insert({
          vaga_id: input.vagaId,
          profile_id: null,
          nome: input.nome,
          experiencia: input.experience,
          info_complementar: info,
          status: 'pendente',
        })
        .select('id')
        .single()

      if (error) return { error: error.message }
      await refreshStore()
      return { candidatoId: data.id }
    },
    [refreshStore],
  )

  const sendMessage = useCallback(
    (candidatoId: string, senderId: string, body: string) => {
      void supabase
        .from('messages')
        .insert({ candidato_id: candidatoId, sender_id: senderId, body })
        .then(({ error }) => {
          if (error) console.error(error.message)
          void refreshStore()
        })
    },
    [refreshStore],
  )

  const addUnit = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Informe o nome da unidade.')
      const { data, error } = await supabase.from('units').insert({ name: trimmed }).select('*').single()
      if (error || !data) {
        if (error?.code === '23505') throw new Error('Já existe uma unidade com esse nome.')
        throw new Error(error?.message || 'Não foi possível criar a unidade.')
      }
      setStore((prev) => ({
        ...prev,
        units: [...prev.units, data as Unit].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      }))
      await refreshStore()
      return data.id as string
    },
    [refreshStore],
  )

  const updateUnit = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Informe o nome da unidade.')
      const { error } = await supabase.from('units').update({ name: trimmed }).eq('id', id)
      if (error) {
        if (error.code === '23505') throw new Error('Já existe uma unidade com esse nome.')
        throw new Error(error.message)
      }
      setStore((prev) => ({
        ...prev,
        units: prev.units.map((u) => (u.id === id ? { ...u, name: trimmed } : u)),
      }))
      await refreshStore()
    },
    [refreshStore],
  )

  const deleteUnit = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('units').delete().eq('id', id)
      if (error) throw new Error(error.message)
      setStore((prev) => ({
        ...prev,
        units: prev.units.filter((u) => u.id !== id),
        vagas: prev.vagas.filter((v) => v.unit_id !== id),
      }))
      await refreshStore()
    },
    [refreshStore],
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
      refreshStore,
      addVaga,
      updateVaga,
      deleteVaga,
      updateCandidatoStatus,
      deleteCandidato,
      upsertProfile,
      replaceExperiences,
      applyToVaga,
      submitPublicApplication,
      sendMessage,
      addUnit,
      updateUnit,
      deleteUnit,
      getVaga,
      getCandidatosByVaga,
      getMessagesForProfile,
    }),
    [
      store,
      refreshStore,
      addVaga,
      updateVaga,
      deleteVaga,
      updateCandidatoStatus,
      deleteCandidato,
      upsertProfile,
      replaceExperiences,
      applyToVaga,
      submitPublicApplication,
      sendMessage,
      getVaga,
      getCandidatosByVaga,
      getMessagesForProfile,
      addUnit,
      updateUnit,
      deleteUnit,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData deve ser usado dentro de DataProvider')
  return ctx
}
