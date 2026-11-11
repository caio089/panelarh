import { getCache } from '@vercel/functions'

const cache = getCache({ namespace: 'panela-velha-kds' })

function key(unitId, date) {
  return `v3:${unitId}:${date}`
}

export async function readKdsCache(unitId, date) {
  try {
    const value = await cache.get(key(unitId, date))
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

export async function saveKdsCache(unitId, date, payload) {
  try {
    await cache.set(key(unitId, date), payload, {
      ttl: 60 * 60 * 24,
      tags: ['kds', `kds-${unitId}`],
      name: 'kds-last-success',
    })
  } catch {
    // A resposta da Saipos continua válida mesmo se o cache estiver indisponível.
  }
}
