import { getCache } from '@vercel/functions'

const cache = getCache({ namespace: 'panela-velha-competition' })

function key(period, date, metric) {
  return `${metric}:${period}:${date}`
}

export async function readCompetitionCache(period, date, metric) {
  try {
    const value = await cache.get(key(period, date, metric))
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

export async function saveCompetitionCache(period, date, metric, payload) {
  const options = { ttl: metric === 'ranking-diario' ? 60 * 10 : period === 'mes' ? 60 * 60 * 12 : 60 * 60 * 36, tags: ['competition'], name: 'competition-scoreboard' }
  try {
    await Promise.all([
      cache.set(key(period, date, metric), payload, options),
      cache.set(`${metric}:${period}:latest`, payload, options),
    ])
  } catch {
    // The page can still use the source response if the cache is temporarily unavailable.
  }
}
