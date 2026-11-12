import { getCache } from '@vercel/functions'

const cache = getCache({ namespace: 'panela-velha-competition' })

function key(period, date, metric, unitId) {
  return `${metric}:${period}:${date}:${unitId}`
}

export async function readCompetitionCache(period, date, metric, unitId) {
  try {
    const value = await cache.get(key(period, date, metric, unitId))
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

export async function saveCompetitionCache(period, date, metric, unitId, payload) {
  const maxAge = metric.startsWith('ranking-') || period === 'mes' ? 60 * 10 : 60 * 2
  try {
    await cache.set(key(period, date, metric, unitId), payload, {
      ttl: maxAge,
      tags: ['competition', unitId],
      name: 'competition-scoreboard',
    })
  } catch {
    // A tela ainda usa a resposta da Saipos se o cache estiver indisponível.
  }
}
