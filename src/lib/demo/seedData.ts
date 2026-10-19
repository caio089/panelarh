import type { AppStore } from '@/lib/data'
import type { Unit, Vaga } from '@/types'

/** Casas da rede. Ids estáveis para o painel reconhecer a mesma unidade. */
export const HOUSE_UNITS: Unit[] = [
  { id: 'unit-dirceu', name: 'Dirceu' },
  { id: 'unit-promorar', name: 'Promorar' },
  { id: 'unit-mocambinho', name: 'Mocambinho' },
]

export function withHouseUnits(units: Unit[]): Unit[] {
  const names = new Set(units.map((unit) => unit.name.trim().toLowerCase()))
  const missing = HOUSE_UNITS.filter((unit) => !names.has(unit.name.toLowerCase()))
  if (missing.length === 0) return units
  return [...units, ...missing].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

const TEST_CREATED_AT = '2026-10-18T12:00:00.000Z'

/** Vagas só para exercitar o fluxo. Ficam na unidade Dirceu. */
export const DIRCEU_TEST_VAGAS: Vaga[] = [
  {
    id: 'vaga-teste-dirceu-atendente',
    unit_id: 'unit-dirceu',
    titulo: 'Atendente de salão (teste)',
    descricao: 'Vaga de teste para o salão do Dirceu. Atende a mesa, anota o pedido e entrega a pizza.',
    localidade: 'Dirceu, Teresina',
    tipo: 'Presencial',
    ativa: true,
    criada_em: TEST_CREATED_AT,
    salario: 'A combinar',
    horario: '17:30 às 23:30',
    regime: 'CLT',
    responsabilidades: 'Receber o cliente, lançar o pedido e acompanhar a mesa até a conta.',
    requisitos: 'Disponibilidade à noite e no fim de semana.',
    diferenciais: 'Experiência em salão.',
    beneficios: 'Refeição no turno.',
  },
  {
    id: 'vaga-teste-dirceu-pizzaiolo',
    unit_id: 'unit-dirceu',
    titulo: 'Pizzaiolo (teste)',
    descricao: 'Vaga de teste para a cozinha do Dirceu. Monta e assa as pizzas no forno.',
    localidade: 'Dirceu, Teresina',
    tipo: 'Presencial',
    ativa: true,
    criada_em: TEST_CREATED_AT,
    salario: 'A combinar',
    horario: '16:00 às 00:00',
    regime: 'CLT',
    responsabilidades: 'Abrir massas, montar os sabores e cuidar do ponto de cada pizza.',
    requisitos: 'Já ter trabalhado em forno ou cozinha quente.',
    diferenciais: 'Conhecer a ficha da casa.',
    beneficios: 'Refeição no turno.',
  },
  {
    id: 'vaga-teste-dirceu-auxiliar',
    unit_id: 'unit-dirceu',
    titulo: 'Auxiliar de cozinha (teste)',
    descricao: 'Vaga de teste para o apoio da cozinha do Dirceu. Prepara insumos e organiza a praça.',
    localidade: 'Dirceu, Teresina',
    tipo: 'Presencial',
    ativa: true,
    criada_em: TEST_CREATED_AT,
    salario: 'A combinar',
    horario: '15:00 às 23:00',
    regime: 'CLT',
    responsabilidades: 'Porcionar ingredientes, manter a praça limpa e apoiar o pizzaiolo.',
    requisitos: 'Disposição para o turno da noite.',
    diferenciais: 'Experiência em cozinha.',
    beneficios: 'Refeição no turno.',
  },
]

export function withDirceuTestVagas(vagas: Vaga[]): Vaga[] {
  const ids = new Set(vagas.map((vaga) => vaga.id))
  const missing = DIRCEU_TEST_VAGAS.filter((vaga) => !ids.has(vaga.id))
  if (missing.length === 0) return vagas
  return [...missing, ...vagas]
}

/** Store inicial. As três unidades já nascem cadastradas, com vagas de teste só no Dirceu. */
export function buildDemoStore(): AppStore {
  return {
    units: withHouseUnits([]),
    vagas: withDirceuTestVagas([]),
    candidatos: [],
    profiles: [],
    experiences: [],
    messages: [],
  }
}
