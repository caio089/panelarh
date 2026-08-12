export type DiscDimension = 'D' | 'I' | 'S' | 'C'

export interface DiscQuestion {
  key: string
  text: string
  dimension: DiscDimension
}

/** Perguntas DISC (Likert 1–5) — versão curta para recrutamento */
export const DISC_QUESTIONS: DiscQuestion[] = [
  { key: 'd1', dimension: 'D', text: 'Gosto de assumir o comando e tomar decisões rápidas.' },
  { key: 'd2', dimension: 'D', text: 'Encaro desafios de frente, mesmo sob pressão.' },
  { key: 'd3', dimension: 'D', text: 'Prefiro resultados concretos a longas discussões.' },
  { key: 'i1', dimension: 'I', text: 'Me energizo ao conversar e influenciar pessoas.' },
  { key: 'i2', dimension: 'I', text: 'Sou otimista e transminto entusiasmo à equipe.' },
  { key: 'i3', dimension: 'I', text: 'Gosto de ambientes colaborativos e dinâmicos.' },
  { key: 's1', dimension: 'S', text: 'Valorizo estabilidade e relações de confiança.' },
  { key: 's2', dimension: 'S', text: 'Sou paciente e consistente no trabalho do dia a dia.' },
  { key: 's3', dimension: 'S', text: 'Prefiro apoiar o time a competir com colegas.' },
  { key: 'c1', dimension: 'C', text: 'Presto atenção a detalhes e padrões de qualidade.' },
  { key: 'c2', dimension: 'C', text: 'Gosto de seguir processos claros e bem definidos.' },
  { key: 'c3', dimension: 'C', text: 'Analiso bem antes de me comprometer com algo.' },
]

export function computeDiscScores(answers: Record<string, number>) {
  const totals: Record<DiscDimension, number> = { D: 0, I: 0, S: 0, C: 0 }
  const counts: Record<DiscDimension, number> = { D: 0, I: 0, S: 0, C: 0 }

  for (const q of DISC_QUESTIONS) {
    const v = answers[q.key]
    if (typeof v === 'number') {
      totals[q.dimension] += v
      counts[q.dimension] += 1
    }
  }

  const score = (d: DiscDimension) =>
    counts[d] ? Math.round((totals[d] / (counts[d] * 5)) * 100) : 0

  return { D: score('D'), I: score('I'), S: score('S'), C: score('C') }
}

export function dominantDisc(scores: { D: number; I: number; S: number; C: number }) {
  const entries = Object.entries(scores) as [DiscDimension, number][]
  entries.sort((a, b) => b[1] - a[1])
  return entries[0]?.[0] ?? 'S'
}

export const DISC_LABELS: Record<DiscDimension, string> = {
  D: 'Dominância',
  I: 'Influência',
  S: 'Estabilidade',
  C: 'Conformidade',
}
