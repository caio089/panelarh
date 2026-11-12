import type { SupabaseClient } from '@supabase/supabase-js'
import type { Vaga } from '@/types'
import { getSupabase } from '@/lib/supabaseClient'

/** O painel usa estes ids. No banco a unidade é o uuid da tabela units. */
const UNIT_ID_BY_NAME: Record<string, string> = {
  Dirceu: 'unit-dirceu',
  Promorar: 'unit-promorar',
  Mocambinho: 'unit-mocambinho',
}

const UNIT_NAME_BY_ID: Record<string, string> = {
  'unit-dirceu': 'Dirceu',
  'unit-promorar': 'Promorar',
  'unit-mocambinho': 'Mocambinho',
}

type VagaRow = {
  id: string
  titulo: string
  descricao: string | null
  localidade: string | null
  tipo: string | null
  ativa: boolean | null
  criada_em: string
  salario: string | null
  horario: string | null
  regime: string | null
  responsabilidades: string | null
  requisitos: string | null
  diferenciais: string | null
  beneficios: string | null
  units: { name: string } | { name: string }[] | null
}

const VAGA_COLUMNS =
  'id, titulo, descricao, localidade, tipo, ativa, criada_em, salario, horario, regime, responsabilidades, requisitos, diferenciais, beneficios, units(name)'

function getDatabase() {
  return getSupabase()
}

function unitNameOf(units: VagaRow['units']) {
  if (!units) return ''
  return Array.isArray(units) ? (units[0]?.name ?? '') : units.name
}

function toVaga(row: VagaRow): Vaga {
  const name = unitNameOf(row.units)
  return {
    id: row.id,
    unit_id: UNIT_ID_BY_NAME[name] ?? 'unit-dirceu',
    titulo: row.titulo,
    descricao: row.descricao,
    localidade: row.localidade,
    tipo: row.tipo,
    ativa: row.ativa,
    criada_em: row.criada_em,
    salario: row.salario,
    horario: row.horario,
    regime: row.regime,
    responsabilidades: row.responsabilidades,
    requisitos: row.requisitos,
    diferenciais: row.diferenciais,
    beneficios: row.beneficios,
  }
}

function blank(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function unitUuid(supabase: SupabaseClient, unitId: string) {
  const name = UNIT_NAME_BY_ID[unitId]
  if (!name) throw new Error('Selecione uma unidade da casa.')
  const { data, error } = await supabase.from('units').select('id').eq('name', name).maybeSingle()
  if (error || !data?.id) throw new Error('Unidade não encontrada no banco.')
  return data.id as string
}

function requireDatabase() {
  const supabase = getDatabase()
  if (!supabase) throw new Error('Banco de vagas não configurado neste ambiente.')
  return supabase
}

/** Lista usada pelo site público e pelo painel. É a mesma tabela. */
export async function listVagas(): Promise<Vaga[]> {
  const supabase = requireDatabase()
  const { data, error } = await supabase.from('vagas').select(VAGA_COLUMNS).order('criada_em', { ascending: false })
  if (error) throw new Error('Não foi possível carregar as vagas.')
  return ((data ?? []) as VagaRow[]).map(toVaga)
}

export async function insertVaga(vaga: Omit<Vaga, 'id' | 'criada_em'>): Promise<Vaga> {
  const supabase = requireDatabase()
  const unitId = await unitUuid(supabase, vaga.unit_id)
  const { data, error } = await supabase
    .from('vagas')
    .insert({
      unit_id: unitId,
      titulo: vaga.titulo.trim(),
      descricao: blank(vaga.descricao),
      localidade: blank(vaga.localidade),
      tipo: blank(vaga.tipo) ?? 'Presencial',
      ativa: vaga.ativa !== false,
      salario: blank(vaga.salario),
      horario: blank(vaga.horario),
      regime: blank(vaga.regime) ?? 'CLT',
      responsabilidades: blank(vaga.responsabilidades),
      requisitos: blank(vaga.requisitos),
      diferenciais: blank(vaga.diferenciais),
      beneficios: blank(vaga.beneficios),
    })
    .select(VAGA_COLUMNS)
    .single()
  if (error || !data) throw new Error('Não foi possível publicar a vaga.')
  return toVaga(data as VagaRow)
}

export async function updateRemoteVaga(vagaId: string, patch: Partial<Vaga>) {
  const supabase = requireDatabase()
  const payload: Record<string, string | boolean | null> = {}
  if (patch.unit_id) payload.unit_id = await unitUuid(supabase, patch.unit_id)
  if (patch.titulo !== undefined) payload.titulo = patch.titulo.trim()
  if (patch.descricao !== undefined) payload.descricao = blank(patch.descricao)
  if (patch.localidade !== undefined) payload.localidade = blank(patch.localidade)
  if (patch.tipo !== undefined) payload.tipo = blank(patch.tipo) ?? 'Presencial'
  if (patch.ativa !== undefined) payload.ativa = patch.ativa !== false
  if (patch.salario !== undefined) payload.salario = blank(patch.salario)
  if (patch.horario !== undefined) payload.horario = blank(patch.horario)
  if (patch.regime !== undefined) payload.regime = blank(patch.regime) ?? 'CLT'
  if (patch.responsabilidades !== undefined) payload.responsabilidades = blank(patch.responsabilidades)
  if (patch.requisitos !== undefined) payload.requisitos = blank(patch.requisitos)
  if (patch.diferenciais !== undefined) payload.diferenciais = blank(patch.diferenciais)
  if (patch.beneficios !== undefined) payload.beneficios = blank(patch.beneficios)
  const { error } = await supabase.from('vagas').update(payload).eq('id', vagaId)
  if (error) throw new Error('Não foi possível atualizar a vaga.')
}

export async function deleteRemoteVaga(vagaId: string) {
  const supabase = requireDatabase()
  const { error } = await supabase.from('vagas').delete().eq('id', vagaId)
  if (error) throw new Error('Não foi possível excluir a vaga.')
}
