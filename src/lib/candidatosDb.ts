import type { CandidateStatus, Candidato } from '@/types'
import { getSupabase } from '@/lib/supabaseClient'

const STATUSES = new Set<CandidateStatus>(['pendente', 'entrevista', 'aprovada', 'reprovada', 'banco'])

type CandidatoRow = {
  id: string
  vaga_id: string
  nome: string
  info_complementar: string | null
  experiencia: string | null
  referencia: string | null
  status: string
  data_inicio_treinamento: string | null
  curriculo_url: string | null
  curriculo_nome: string | null
  criado_em: string
}

const COLUMNS =
  'id, vaga_id, nome, info_complementar, experiencia, referencia, status, data_inicio_treinamento, curriculo_url, curriculo_nome, criado_em'

function requireDatabase() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Banco de candidatos não configurado neste ambiente.')
  return supabase
}

function toCandidato(row: CandidatoRow): Candidato {
  const status = STATUSES.has(row.status as CandidateStatus) ? (row.status as CandidateStatus) : 'pendente'
  return {
    id: row.id,
    vaga_id: row.vaga_id,
    profile_id: null,
    nome: row.nome,
    info_complementar: row.info_complementar,
    experiencia: row.experiencia,
    referencia: row.referencia,
    status,
    data_inicio_treinamento: row.data_inicio_treinamento,
    curriculo_url: row.curriculo_url,
    curriculo_nome: row.curriculo_nome,
    criado_em: row.criado_em,
  }
}

export function candidatoKey(candidato: Pick<Candidato, 'vaga_id' | 'nome' | 'criado_em'>) {
  return `${candidato.vaga_id}|${candidato.nome.trim().toLowerCase()}|${candidato.criado_em}`
}

/** Lista compartilhada. Qualquer navegador do painel lê estes registros. */
export async function listCandidatos(): Promise<Candidato[]> {
  const supabase = requireDatabase()
  const { data, error } = await supabase.from('candidatos').select(COLUMNS).order('criado_em', { ascending: false })
  if (error) throw new Error('Não foi possível carregar os candidatos.')
  return ((data ?? []) as CandidatoRow[]).map(toCandidato)
}

export async function insertCandidato(input: {
  vagaId: string
  nome: string
  experiencia: string | null
  info: string | null
  criadoEm?: string
}): Promise<Candidato> {
  const supabase = requireDatabase()
  const nome = input.nome.trim()
  if (nome.length < 2) throw new Error('Informe o nome completo.')
  const { data, error } = await supabase
    .from('candidatos')
    .insert({
      vaga_id: input.vagaId,
      nome,
      experiencia: input.experiencia,
      info_complementar: input.info,
      status: 'pendente',
      criado_em: input.criadoEm,
    })
    .select(COLUMNS)
    .single()
  if (error || !data) throw new Error('Não foi possível registrar a candidatura.')
  return toCandidato(data as CandidatoRow)
}

export async function updateRemoteCandidato(
  candidatoId: string,
  patch: { status: CandidateStatus; data_inicio_treinamento: string | null },
) {
  const supabase = requireDatabase()
  const { error } = await supabase
    .from('candidatos')
    .update({
      status: patch.status,
      data_inicio_treinamento: patch.status === 'aprovada' ? patch.data_inicio_treinamento : null,
    })
    .eq('id', candidatoId)
  if (error) throw new Error('Não foi possível atualizar o candidato.')
}

export async function deleteRemoteCandidato(candidatoId: string) {
  const supabase = requireDatabase()
  const { error } = await supabase.from('candidatos').delete().eq('id', candidatoId)
  if (error) throw new Error('Não foi possível excluir o candidato.')
}
