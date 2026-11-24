import assert from 'node:assert/strict'
import test from 'node:test'

test('duas instâncias só consultam a Saipos quando a reserva mensal é concedida', async (t) => {
  const environment = {
    COMPETITION_WORKER_KEY: 'fixture-worker',
    VITE_SUPABASE_URL: 'https://supabase.invalid',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture-public',
    RUNTIME_CACHE_DISABLE_BUILD_CACHE: 'true',
  }
  for (const [key, value] of Object.entries(environment)) {
    const previous = process.env[key]
    process.env[key] = value
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous })
  }
  let claims = 0
  let sourceReads = 0
  let databaseUnavailable = true
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.hostname === 'supabase.invalid') {
      assert.equal(url.pathname, '/rest/v1/rpc/claim_competition_fill')
      assert.deepEqual(JSON.parse(options.body), { p_unit_id: 'dirceu' })
      assert.equal(options.headers['x-competition-worker'], environment.COMPETITION_WORKER_KEY)
      assert.equal(options.headers.apikey, environment.VITE_SUPABASE_PUBLISHABLE_KEY)
      if (databaseUnavailable) return new Response(null, { status: 503 })
      return Response.json(++claims === 1)
    }
    assert.equal(url.hostname, 'data.saipos.io')
    sourceReads++
    return Response.json([])
  })
  const args = { start: '2026-11-01', end: '2026-11-01', today: '2026-11-01', unitId: 'dirceu', token: 'fixture' }
  async function schedule(instance) {
    const { loadCompetitionSpan } = await import(`../server/competitionDays.js?instance=${instance}`)
    const partial = await loadCompetitionSpan(args)
    assert.equal(partial.partial, true)
    return partial.fill
  }
  await (await schedule('unavailable'))()
  assert.equal(sourceReads, 0)
  databaseUnavailable = false
  const [first, second] = await Promise.all([schedule('first'), schedule('second')])
  await Promise.all([first(), second()])
  assert.equal(claims, 2)
  assert.ok(sourceReads > 0)
})
