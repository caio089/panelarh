import { toISODate, startOfToday } from './dateUtils'
import type { Colaborador, ScheduleDayIndex, ShiftPreference } from './types'

/** Dados editáveis no formulário de colaborador. */
export interface CollaboratorInput {
  nome: string
  cargo: string
  telefone: string
  admissao: string
  entradaPrevista: string
  turnoPreferido: ShiftPreference
  folgaPreferida: ScheduleDayIndex | null
  isGerente: boolean
}

export type CollaboratorErrors = Partial<Record<keyof CollaboratorInput, string>>

const NAME_PATTERN = /^[\p{L}][\p{L}' .-]*$/u
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function emptyCollaboratorInput(): CollaboratorInput {
  return {
    nome: '',
    cargo: '',
    telefone: '',
    admissao: toISODate(startOfToday()),
    entradaPrevista: '08:00',
    turnoPreferido: 'flexivel',
    folgaPreferida: null,
    isGerente: false,
  }
}

export function inputFromCollaborator(c: Colaborador): CollaboratorInput {
  return {
    nome: c.nome,
    cargo: c.cargo,
    telefone: c.telefone,
    admissao: c.admissao,
    entradaPrevista: c.entradaPrevista,
    turnoPreferido: c.turnoPreferido,
    folgaPreferida: c.folgaPreferida,
    isGerente: c.isGerente,
  }
}

/** Mantém só dígitos e formata como (DD) 9XXXX-XXXX / (DD) XXXX-XXXX. */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/** Normaliza espaços e capitalização simples do nome. */
function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function validateCollaborator(input: CollaboratorInput): CollaboratorErrors {
  const errors: CollaboratorErrors = {}
  const nome = normalizeName(input.nome)

  if (nome.length < 3) errors.nome = 'Informe o nome completo (mín. 3 letras).'
  else if (nome.length > 80) errors.nome = 'Nome muito longo (máx. 80 caracteres).'
  else if (!NAME_PATTERN.test(nome)) errors.nome = 'Use apenas letras, espaços e acentos.'

  if (!input.cargo.trim()) errors.cargo = 'Selecione o cargo.'

  const phoneDigits = input.telefone.replace(/\D/g, '')
  if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
    errors.telefone = 'Telefone deve ter DDD + 8 ou 9 dígitos.'
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.admissao)) errors.admissao = 'Data de admissão inválida.'
  else if (input.admissao > toISODate(startOfToday())) errors.admissao = 'A admissão não pode ser no futuro.'

  if (!TIME_PATTERN.test(input.entradaPrevista)) errors.entradaPrevista = 'Horário inválido (HH:mm).'

  return errors
}

/** Retorna o input pronto para persistir (campos limpos). */
export function sanitizeCollaboratorInput(input: CollaboratorInput): CollaboratorInput {
  return {
    ...input,
    nome: normalizeName(input.nome),
    cargo: input.cargo.trim(),
    telefone: input.telefone ? formatPhone(input.telefone) : '',
  }
}
