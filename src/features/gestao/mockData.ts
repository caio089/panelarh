import type { GestaoDataset } from './types'

/** Histórico vazio. Ocorrências e ponto só entram quando houver registro real. */
export function getMockGestaoDataset(): GestaoDataset {
  return {
    colaboradores: [],
    ocorrencias: [],
    pontos: [],
    sincronizadoEm: new Date(0).toISOString(),
  }
}
