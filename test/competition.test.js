import assert from 'node:assert/strict'
import test from 'node:test'
import competition from '../api/competition.js'

const contextSymbol = Symbol.for('@vercel/request-context')

function sale(id, type = 1, canceled = 'N') {
  return { id_sale: id, id_sale_type: type, canceled }
}

function kitchenHistory(id, seconds) {
  return {
    id_sale: id,
    histories: [
      { order: 1, desc_store_sale_status: 'Cozinha', duration_time_seconds: seconds },
      { order: 2, desc_store_sale_status: 'Finalizado', duration_time_seconds: 0 },
    ],
  }
}

function mockSaipos(t, rowsFor, now = '2026-11-02T23:00:00Z') {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
  const background = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.hostname, 'data.saipos.io')
    const query = url.searchParams
    assert.equal(query.get('p_date_column_filter'), 'shift_date')
    const start = query.get('p_filter_date_start').slice(0, 10)
    const end = query.get('p_filter_date_end').slice(0, 10)
    assert.equal(start, end)
    const rows = rowsFor(url.pathname, start)
    if (rows instanceof Response) return rows
    const offset = Number(query.get('p_offset'))
    const limit = Number(query.get('p_limit'))
    return Response.json(rows.slice(offset, offset + limit))
  })

  const context = globalThis[contextSymbol]
  const env = {
    API_SAIPOS: 'fixture-dirceu',
    API_SAIPOS_PROMORAR: 'fixture-promorar',
    API_SAIPOS_MOCAMBINHO: 'fixture-mocambinho',
    RUNTIME_CACHE_DISABLE_BUILD_CACHE: 'true',
  }
  const originalEnv = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]))
  Object.assign(process.env, env)
  globalThis[contextSymbol] = { get: () => ({ waitUntil: (promise) => background.push(promise) }) }

  async function finishBackground() {
    while (background.length) await Promise.all(background.splice(0))
  }

  t.after(async () => {
    await finishBackground()
    if (context === undefined) delete globalThis[contextSymbol]
    else globalThis[contextSymbol] = context
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  return { finishBackground }
}

async function request(query) {
  const result = { headers: new Map() }
  await competition({ method: 'GET', query }, {
    setHeader(name, value) { result.headers.set(name, value) },
    status(code) { result.status = code; return this },
    json(body) { result.body = body },
  })
  return result
}

test('o diário pagina vendas e histórico completos e conta cada venda elegível uma vez', async (t) => {
  const orderCount = 1250
  const sales = Array.from({ length: orderCount }, (_, index) => sale(index + 1, index % 2 ? 3 : 1))
  const histories = sales.map((row) => kitchenHistory(row.id_sale, row.id_sale <= 600 ? 600 : 3000))
  sales.push(sales[0], sale(1251, 2), sale(1252, 4), sale(1253, 1, 'Y'))
  histories.push(histories[0], kitchenHistory(1251, 600), kitchenHistory(1253, 1200))
  mockSaipos(t, (path) => path.endsWith('/search_sales') ? sales : histories)

  const query = { unidade: 'dirceu', dia: '2026-11-01', periodo: 'dia' }
  const [volume, kitchen] = await Promise.all([request(query), request({ ...query, dados: 'cozinha' })])
  assert.equal(volume.status, 200)
  assert.equal(volume.body.unit.orders, orderCount)
  assert.equal(kitchen.status, 200)
  assert.equal(kitchen.body.unit.kitchenMinutes, 30.8)
})

test('o botão de atualizar recarrega o turno anterior e incorpora vendas lançadas depois', async (t) => {
  let sales = [sale(1)]
  let sourceAvailable = true
  mockSaipos(t, () => sourceAvailable ? sales : new Response(null, { status: 400 }))
  const query = { unidade: 'promorar', dia: '2026-11-01', periodo: 'dia' }
  const initial = await request(query)
  assert.equal(initial.status, 200)
  assert.equal(initial.body.unit.orders, 1)

  sales = [sale(1), sale(2, 3)]
  const refreshed = await request({ ...query, atualiza: '1' })
  assert.equal(refreshed.status, 200)
  assert.equal(refreshed.body.unit.orders, 2)
  assert.equal(refreshed.headers.get('Cache-Control'), 'no-store')

  sourceAvailable = false
  const fallback = await request({ ...query, atualiza: '1' })
  assert.equal(fallback.status, 200)
  assert.equal(fallback.body.unit.orders, 2)
  assert.equal(fallback.body.stale, true)
})

test('uma página repetida da Saipos falha sem publicar uma contagem truncada', async (t) => {
  const page = Array.from({ length: 300 }, (_, index) => sale(index + 1))
  mockSaipos(t, () => Response.json(page))
  const result = await request({ unidade: 'dirceu', dia: '2026-10-31', periodo: 'dia' })
  assert.equal(result.status, 503)
  assert.match(result.body.error, /repetiu uma página/)
  assert.equal(result.body.unit, undefined)
})

test('o mensal mantém vendas completas disponíveis e espera pelos dias de cozinha para publicar a média', async (t) => {
  let historyAvailable = false
  const { finishBackground } = mockSaipos(t, (path, date) => {
    if (path.endsWith('/search_sales')) return date.endsWith('-01') ? [sale(1), sale(2)] : [sale(3)]
    if (date.endsWith('-01')) return [kitchenHistory(1, 600), kitchenHistory(2, 600)]
    if (!historyAvailable) return new Response(null, { status: 400 })
    return [kitchenHistory(3, 1800)]
  })

  const query = { unidade: 'mocambinho', periodo: 'mes' }
  const initial = await request(query)
  assert.equal(initial.body.partial, true)
  assert.equal(initial.body.unit.orders, null)
  assert.equal(initial.body.unit.kitchenMinutes, null)
  await finishBackground()
  const partial = await request(query)
  assert.equal(partial.status, 200)
  assert.equal(partial.body.partial, true)
  assert.equal(partial.body.unit.orders, 3)
  assert.equal(partial.body.unit.kitchenMinutes, null)
  assert.deepEqual(partial.body.coverage, { totalDays: 2, salesDays: 2, kitchenDays: 1 })
  const incompleteRanking = await request({ ...query, modo: 'diario' })
  assert.equal(incompleteRanking.body.days, undefined)
  await finishBackground()

  historyAvailable = true
  t.mock.timers.tick(61_000)
  await request({ ...query, atualiza: '1' })
  await finishBackground()
  const ready = await request(query)
  assert.equal(ready.status, 200)
  assert.equal(ready.body.partial, false)
  assert.equal(ready.body.unit.orders, 3)
  assert.equal(ready.body.unit.kitchenMinutes, 16.7)

  const ranking = await request({ ...query, modo: 'diario' })
  assert.deepEqual(ranking.body.days, [
    { date: '2026-11-01', orders: 2, kitchenMinutes: 10 },
    { date: '2026-11-02', orders: 1, kitchenMinutes: 30 },
  ])
})
