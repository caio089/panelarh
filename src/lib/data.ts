import type { CandidateStatus, Candidato, Experience, Message, Profile, Unit, Vaga } from '@/types'

export interface AppStore {
  units: Unit[]
  vagas: Vaga[]
  candidatos: Candidato[]
  profiles: Profile[]
  experiences: Experience[]
  messages: Message[]
}

export function emptyStore(): AppStore {
  return {
    units: [],
    vagas: [],
    candidatos: [],
    profiles: [],
    experiences: [],
    messages: [],
  }
}

export function countByStatus(list: Candidato[]) {
  const c: Record<CandidateStatus, number> = {
    pendente: 0,
    entrevista: 0,
    aprovada: 0,
    reprovada: 0,
    banco: 0,
  }
  list.forEach((item) => {
    if (item.status in c) c[item.status] += 1
  })
  return c
}
