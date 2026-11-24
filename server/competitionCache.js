import { getCache } from '@vercel/functions'

const cache = getCache({ namespace: 'panela-velha-competition-days' })
const CACHE_VERSION = 'v2'
const RETENTION_SECONDS = 35 * 24 * 60 * 60
const LOCAL_READ_TTL_MS = 5_000
const LOCAL_LIMIT = 256
const local = new Map()

function key(unitId, day, metric) {
  return `${CACHE_VERSION}:${unitId}:${day}:${metric}`
}

function isSnapshot(snapshot, metric) {
  if (!Number.isFinite(snapshot?.fetchedAt)) return false
  if (metric === 'sales') return Number.isInteger(snapshot.value) && snapshot.value >= 0
  const { seconds, samples } = snapshot.value ?? {}
  return Number.isFinite(seconds) && seconds >= 0 && Number.isInteger(samples) && samples >= 0
}

function remember(id, snapshot) {
  local.delete(id)
  local.set(id, { snapshot, checkedAt: Date.now() })
  if (local.size > LOCAL_LIMIT) local.delete(local.keys().next().value)
  return snapshot
}

export async function readCompetitionSnapshot(unitId, day, metric, maxAgeMs = LOCAL_READ_TTL_MS) {
  const id = key(unitId, day, metric)
  const entry = local.get(id)
  // A day pending in another instance should become visible promptly.
  const ttl = entry?.snapshot ? maxAgeMs : Math.min(maxAgeMs, LOCAL_READ_TTL_MS)
  if (entry && Date.now() - entry.checkedAt < ttl) return entry.snapshot
  let regional
  try {
    regional = await cache.get(id)
  } catch {
    // Uma falha no cache regional ainda permite aproveitar a leitura desta instância.
  }
  const fallback = local.get(id)?.snapshot ?? entry?.snapshot
  if (isSnapshot(regional, metric) && (!fallback || regional.fetchedAt > fallback.fetchedAt)) return remember(id, regional)
  if (fallback && Date.now() - fallback.fetchedAt < RETENTION_SECONDS * 1000) return remember(id, fallback)
  return remember(id, null)
}

export async function saveCompetitionSnapshot(unitId, day, metric, snapshot) {
  if (!isSnapshot(snapshot, metric)) throw new Error('A Saipos devolveu métricas inválidas para este turno.')
  const id = key(unitId, day, metric)
  const current = await readCompetitionSnapshot(unitId, day, metric, 0)
  if (current && current.fetchedAt > snapshot.fetchedAt) return current
  remember(id, snapshot)
  try {
    await cache.set(id, snapshot, {
      ttl: RETENTION_SECONDS,
      tags: ['competition-day', unitId],
      name: 'competition-day',
    })
  } catch {
    // A resposta continua disponível nesta instância.
  }
  return snapshot
}
