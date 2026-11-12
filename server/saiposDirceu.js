/**
 * Consulta a API de dados da Saipos e devolve só o resumo da unidade Dirceu.
 * Nome, telefone, documento e endereço de cliente não saem daqui.
 */

const SAIPOS_BASE = 'https://data.saipos.io/v1'
const TIME_ZONE = 'America/Fortaleza'
const PAGE_SIZE = 300
const MAX_PAGES = 2
const ATTEMPTS = 2
const REQUEST_TIMEOUT_MS = 18000
const MAX_IN_FLIGHT = 2

/** No máximo duas consultas no total: a API de dados da Saipos limita o pool compartilhado. */
let inFlight = 0
const waiters = []

function oneAtATime(task) {
  return new Promise((resolve, reject) => {
    const run = () => {
      inFlight += 1
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          inFlight -= 1
          const next = waiters.shift()
          if (next) next()
        })
    }
    if (inFlight < MAX_IN_FLIGHT) run()
    else waiters.push(run)
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const SALE_TYPES = {
  1: 'Entrega',
  2: 'Balcão',
  3: 'Salão',
  4: 'Ficha',
}

/** Competição: entrega e salão. Balcão (2) e ficha (4) ficam de fora dos dois lados. */
const COMPETITION_SALE_TYPES = new Set([1, 3])

export function todayInFortaleza(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now)
}

/** O KDS acompanha o turno noturno da loja, inclusive depois da meia-noite. */
export function currentShiftDateInFortaleza(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  const today = todayInFortaleza(now)
  return hour * 60 + minute >= 17 * 60 + 30 ? today : shiftIsoDate(today, -1)
}

export function shiftIsoDate(iso, delta) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function label(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return text(value)
}

function normalizeToken(token) {
  const trimmed = String(token || '').trim()
  if (!trimmed) return ''
  return trimmed.toLowerCase().startsWith('bearer ') ? trimmed : `Bearer ${trimmed}`
}

function asRows(body) {
  if (Array.isArray(body)) return body
  if (body && Array.isArray(body.data)) return body.data
  if (body && Array.isArray(body.result)) return body.result
  return []
}

function retryable(error) {
  if (!(error instanceof Error)) return true
  if (error.name === 'AbortError') return false
  if (error.name === 'TimeoutError') return true
  return !error.message.startsWith('A chave da Saipos') && !error.message.includes('recusou a consulta')
}

function fetchWithDeadline(url, token, signal) {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  let timer
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      const error = new Error('A Saipos demorou demais.')
      error.name = 'TimeoutError'
      reject(error)
    }, REQUEST_TIMEOUT_MS)
  })
  const request = fetch(url, {
    headers: { Authorization: normalizeToken(token), Accept: 'application/json' },
    signal: controller.signal,
  })
  request.catch(() => undefined)
  return Promise.race([request, deadline]).finally(() => {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  })
}

async function saiposGet(path, params, token, signal) {
  const url = new URL(`${SAIPOS_BASE}${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))

  return oneAtATime(async () => {
    let lastMessage = 'A Saipos não respondeu.'
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      if (signal?.aborted) throw new DOMException('Consulta cancelada.', 'AbortError')
      if (attempt > 0) await sleep(600)
      if (signal?.aborted) throw new DOMException('Consulta cancelada.', 'AbortError')
      try {
        const response = await fetchWithDeadline(url, token, signal)
        const raw = await response.text()
        if (response.status === 504 || response.status === 503 || response.status === 429) {
          lastMessage = 'A Saipos está ocupada agora.'
          continue
        }
        if (response.status === 401) {
          throw new Error('A chave da Saipos foi recusada.')
        }
        if (!response.ok) {
          throw new Error(`A Saipos recusou a consulta (${response.status}).`)
        }
        return raw ? JSON.parse(raw) : []
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
          throw new DOMException('Consulta cancelada.', 'AbortError')
        }
        if (!retryable(error)) throw error
        if (error instanceof Error && error.message) lastMessage = error.message
      }
    }
    throw new Error(lastMessage)
  })
}

async function* saiposPages(path, params, token, signal, maxPages = MAX_PAGES, pageSize = PAGE_SIZE) {
  for (let page = 0; page < maxPages; page += 1) {
    const batch = asRows(
      await saiposGet(path, { ...params, p_limit: pageSize, p_offset: page * pageSize }, token, signal),
    )
    const last = batch.length < pageSize || page === maxPages - 1
    yield { batch, last }
    if (batch.length < pageSize) return
  }
}

function dayRange(start, end = start) {
  return {
    p_filter_date_start: `${start}T00:00:00`,
    p_filter_date_end: `${end}T23:59:59`,
  }
}

function monthEnd(iso) {
  const [year, month] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

function startOfWeek(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekday = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday))
  return date.toISOString().slice(0, 10)
}

function periodBounds(anchor, period, today) {
  const day = anchor > today ? today : anchor
  if (period === 'semana') {
    const start = startOfWeek(day)
    const end = shiftIsoDate(start, 6)
    return { start, end: end > today ? today : end }
  }
  if (period === 'mes') {
    const start = `${day.slice(0, 7)}-01`
    const end = monthEnd(day)
    return { start, end: end > today ? today : end }
  }
  return { start: day, end: day }
}

function eachDay(start, end) {
  const days = []
  let cursor = start
  while (cursor <= end) {
    days.push(cursor)
    cursor = shiftIsoDate(cursor, 1)
  }
  return days
}

function reportBody(day, period, bounds, category, rows, summarize, partial, unit = 'Dirceu') {
  return {
    unit,
    date: day,
    period,
    start: bounds.start,
    end: bounds.end,
    category,
    partial,
    fetchedAt: new Date().toISOString(),
    report: summarize(rows),
  }
}

function roundMoney(value) {
  return Math.round(value * 100) / 100
}

function saleMoney(row) {
  const source = row.totals && typeof row.totals === 'object' ? row.totals : row
  return {
    amount: num(source.total_amount),
    discount: num(source.total_discount),
    increase: num(source.total_increase),
  }
}

function isCanceledSale(row) {
  return row.canceled === 'Y' || row.canceled === true
}

function isCompetitionSale(row) {
  return COMPETITION_SALE_TYPES.has(num(row.id_sale_type)) && !isCanceledSale(row)
}

function saleKey(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return text(value)
}

/** Média e mediana em minutos. Cada item da lista é o tempo de uma venda. */
function durationStats(seconds) {
  const timed = seconds.filter((value) => value > 0)
  if (timed.length === 0) return { averageMinutes: null, medianMinutes: null }
  const sorted = timed.slice().sort((a, b) => a - b)
  const mean = timed.reduce((sum, value) => sum + value, 0) / timed.length
  return {
    averageMinutes: Math.round((mean / 60) * 10) / 10,
    medianMinutes: Math.round((sorted[Math.floor(sorted.length / 2)] / 60) * 10) / 10,
  }
}

/**
 * Soma o tempo no status Cozinha. Uma venda conta uma vez.
 * Etapa ainda aberta (duração zero) e cancelamento não entram na média.
 */
function competitionKitchenSeconds(row) {
  const steps = (Array.isArray(row.histories) ? row.histories : [])
    .slice()
    .sort((a, b) => num(a.order) - num(b.order))
  const lastName = text(steps[steps.length - 1]?.desc_store_sale_status)
  if (/cancel/i.test(lastName)) return null
  let seconds = 0
  let timed = false
  for (const step of steps) {
    if (text(step.desc_store_sale_status) !== 'Cozinha') continue
    const value = Number(step.duration_time_seconds)
    if (!Number.isFinite(value) || value <= 0) continue
    seconds += value
    timed = true
  }
  return timed ? seconds : null
}

/** Quantidade de entrega + salão já sem canceladas. O relatório operacional continua com todos os canais. */
export function competitionOrderCount(report) {
  const types = Array.isArray(report?.byType) ? report.byType : []
  return types.reduce((sum, item) => (
    COMPETITION_SALE_TYPES.has(num(item.id)) ? sum + num(item.count) : sum
  ), 0)
}

function clock(value) {
  const raw = text(value)
  const match = raw.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : ''
}

function orderLine(row) {
  const money = saleMoney(row)
  const payments = Array.isArray(row.payments) ? row.payments : []
  const ticket = row.ticket && typeof row.ticket === 'object'
    ? label(row.ticket.number) || label(row.ticket.service_ticket_number)
    : label(row.ticket)
  const partner = row.partner_sale && typeof row.partner_sale === 'object' ? text(row.partner_sale.desc_store_partner) : ''
  const delivery = row.delivery && typeof row.delivery === 'object' ? num(row.delivery.delivery_fee) : 0
  const shift = row.store_shift && typeof row.store_shift === 'object' ? text(row.store_shift.desc_store_shift) : ''
  const coupon = row.discount_coupon && typeof row.discount_coupon === 'object' ? text(row.discount_coupon.coupon) : ''
  const nfce = row.nfce && typeof row.nfce === 'object' && row.nfce.numero ? String(row.nfce.numero) : ''
  return {
    date: text(row.shift_date).slice(0, 10) || text(row.created_at).slice(0, 10),
    time: clock(row.created_at),
    number: label(row.sale_number) || ticket || label(row.id_sale),
    channel: SALE_TYPES[num(row.id_sale_type)] || 'Outro',
    amount: roundMoney(money.amount),
    discount: roundMoney(money.discount),
    increase: roundMoney(money.increase),
    payment: payments.map((payment) => text(payment.desc_store_payment_type)).filter(Boolean).join(' · ') || 'Não informado',
    canceled: isCanceledSale(row),
    shift,
    partner,
    coupon,
    discountReason: text(row.discount_reason),
    deliveryFee: roundMoney(delivery),
    nfce,
  }
}

function summarizeSales(rows) {
  const byType = new Map()
  const byPayment = new Map()
  const byShift = new Map()
  const byHour = new Map()
  const coupons = new Map()
  const orders = []
  let revenue = 0
  let discounts = 0
  let increases = 0
  let deliveryFees = 0
  let canceledCount = 0

  for (const row of rows) {
    const line = orderLine(row)
    orders.push(line)
    if (line.canceled) {
      canceledCount += 1
      continue
    }
    const money = saleMoney(row)
    const typeId = num(row.id_sale_type)
    revenue += money.amount
    discounts += money.discount
    increases += money.increase
    deliveryFees += line.deliveryFee

    const type = byType.get(typeId) || { id: typeId, label: line.channel, count: 0, revenue: 0 }
    type.count += 1
    type.revenue += money.amount
    byType.set(typeId, type)

    const payments = Array.isArray(row.payments) ? row.payments : []
    for (const payment of payments) {
      const label = text(payment.desc_store_payment_type) || 'Não informado'
      const current = byPayment.get(label) || { label, amount: 0, count: 0 }
      current.amount += num(payment.payment_amount)
      current.count += 1
      byPayment.set(label, current)
    }

    if (line.shift) {
      const shift = byShift.get(line.shift) || { label: line.shift, count: 0, revenue: 0 }
      shift.count += 1
      shift.revenue += money.amount
      byShift.set(line.shift, shift)
    }
    if (line.time) {
      const hour = line.time.slice(0, 2)
      const bucket = byHour.get(hour) || { hour, count: 0, revenue: 0 }
      bucket.count += 1
      bucket.revenue += money.amount
      byHour.set(hour, bucket)
    }
    if (line.coupon) {
      const coupon = coupons.get(line.coupon) || { label: line.coupon, count: 0, discount: 0 }
      coupon.count += 1
      coupon.discount += money.discount
      coupons.set(line.coupon, coupon)
    }
  }

  const count = rows.length - canceledCount
  const moneyOf = (item) => ({ ...item, revenue: roundMoney(item.revenue) })
  return {
    count,
    canceledCount,
    revenue: roundMoney(revenue),
    discounts: roundMoney(discounts),
    increases: roundMoney(increases),
    deliveryFees: roundMoney(deliveryFees),
    averageTicket: count ? roundMoney(revenue / count) : 0,
    byType: [...byType.values()].map(moneyOf).sort((a, b) => b.revenue - a.revenue),
    byPayment: [...byPayment.values()]
      .map((item) => ({ ...item, amount: roundMoney(item.amount) }))
      .sort((a, b) => b.amount - a.amount),
    byShift: [...byShift.values()].map(moneyOf).sort((a, b) => b.revenue - a.revenue),
    byHour: [...byHour.values()].map(moneyOf).sort((a, b) => a.hour.localeCompare(b.hour)),
    coupons: [...coupons.values()]
      .map((item) => ({ ...item, discount: roundMoney(item.discount) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    orders: orders
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.number.localeCompare(b.number))
      .slice(0, 200),
    orderTotal: orders.length,
  }
}

function summarizeItems(rows) {
  const items = new Map()
  const extras = new Map()
  let quantityTotal = 0
  let revenueTotal = 0
  let deletedCount = 0

  for (const row of rows) {
    const nested = Array.isArray(row.items) ? row.items : [row]
    for (const item of nested) {
      if (!item || typeof item !== 'object') continue
      const deleted = item.deleted
      if (deleted === 'Y' || deleted === true || deleted === 'true') {
        deletedCount += 1
        continue
      }
      const name = text(item.desc_sale_item) || text(item.description)
      if (!name) continue
      const quantity = num(item.quantity) || 1
      const revenue = num(item.unit_price) * quantity
      quantityTotal += quantity
      revenueTotal += revenue
      const current = items.get(name) || { name, quantity: 0, revenue: 0, orders: 0 }
      current.quantity += quantity
      current.revenue += revenue
      current.orders += 1
      items.set(name, current)

      const choices = Array.isArray(item.choices) ? item.choices : []
      for (const choice of choices) {
        if (!choice || choice.deleted === 'Y') continue
        const choiceName = text(choice.desc_sale_item_choice)
        if (!choiceName) continue
        const choiceQty = num(choice.quantity) || quantity
        const extra = extras.get(choiceName) || { name: choiceName, quantity: 0 }
        extra.quantity += choiceQty
        extras.set(choiceName, extra)
      }
    }
  }

  const products = [...items.values()]
    .map((item) => ({ ...item, quantity: roundMoney(item.quantity), revenue: roundMoney(item.revenue) }))
    .sort((a, b) => b.quantity - a.quantity)

  return {
    productCount: products.length,
    quantity: roundMoney(quantityTotal),
    revenue: roundMoney(revenueTotal),
    deletedCount,
    products: products.slice(0, 40),
    extras: [...extras.values()]
      .map((item) => ({ ...item, quantity: roundMoney(item.quantity) }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20),
  }
}

function riderName(row) {
  const men = Array.isArray(row.delivery_man) ? row.delivery_man : []
  return men.map((man) => text(man.delivery_man_name)).filter(Boolean).join(' · ')
}

function deliveryPartner(row, current) {
  if (current) return current
  const external = row.partner_delivery
  if (external && typeof external === 'object') {
    return text(external.desc_partner_delivery) || text(external.partner_name) || text(external.name)
  }
  return ''
}

/** Pedidos com id_sale_type 1. Endereço e cliente ficam no servidor. */
function summarizeDeliveries(rows) {
  const byPartner = new Map()
  const byRider = new Map()
  const byHour = new Map()
  const orders = []
  let revenue = 0
  let fees = 0
  let canceledCount = 0

  for (const row of rows) {
    if (num(row.id_sale_type) !== 1) continue
    const line = orderLine(row)
    line.partner = deliveryPartner(row, line.partner) || 'Entrega própria'
    line.rider = riderName(row) || 'Sem motoboy'
    orders.push(line)
    if (line.canceled) {
      canceledCount += 1
      continue
    }
    revenue += line.amount
    fees += line.deliveryFee

    const partner = byPartner.get(line.partner) || { label: line.partner, count: 0, revenue: 0, fees: 0 }
    partner.count += 1
    partner.revenue += line.amount
    partner.fees += line.deliveryFee
    byPartner.set(line.partner, partner)

    const rider = byRider.get(line.rider) || { label: line.rider, count: 0, fees: 0 }
    rider.count += 1
    rider.fees += line.deliveryFee
    byRider.set(line.rider, rider)

    if (line.time) {
      const hour = line.time.slice(0, 2)
      const bucket = byHour.get(hour) || { hour, count: 0, revenue: 0 }
      bucket.count += 1
      bucket.revenue += line.amount
      byHour.set(hour, bucket)
    }
  }

  const count = orders.length - canceledCount
  const moneyOf = (item) => ({ ...item, revenue: roundMoney(item.revenue) })
  return {
    count,
    canceledCount,
    revenue: roundMoney(revenue),
    fees: roundMoney(fees),
    averageTicket: count ? roundMoney(revenue / count) : 0,
    averageFee: count ? roundMoney(fees / count) : 0,
    byPartner: [...byPartner.values()]
      .map((item) => ({ ...item, revenue: roundMoney(item.revenue), fees: roundMoney(item.fees) }))
      .sort((a, b) => b.revenue - a.revenue),
    byRider: [...byRider.values()]
      .map((item) => ({ ...item, fees: roundMoney(item.fees) }))
      .sort((a, b) => b.fees - a.fees || b.count - a.count),
    byHour: [...byHour.values()].map(moneyOf).sort((a, b) => a.hour.localeCompare(b.hour)),
    orders: orders
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.number.localeCompare(b.number))
      .slice(0, 200),
    orderTotal: orders.length,
  }
}

function summarizeFinance(rows) {
  let due = 0
  let paid = 0
  const byCategory = new Map()
  const entries = []

  for (const row of rows) {
    const amount = num(row.amount)
    const isPaid = row.paid === 'Y' || row.paid === true
    due += amount
    if (isPaid) paid += amount
    const category = text(row.desc_store_category_financial) || 'Sem categoria'
    const bucket = byCategory.get(category) || { label: category, amount: 0, count: 0 }
    bucket.amount += amount
    bucket.count += 1
    byCategory.set(category, bucket)
    entries.push({
      description: text(row.desc_store_fin_transaction) || 'Lançamento',
      category,
      provider: text(row.provider_trade_name),
      amount: roundMoney(amount),
      paid: isPaid,
      recurring: row.recurring === 'Y',
      installment: num(row.installment),
      totalInstallments: num(row.total_installments),
      paymentMethod: text(row.desc_store_payment_method),
      note: text(row.notes),
    })
  }

  entries.sort((a, b) => Number(a.paid) - Number(b.paid) || b.amount - a.amount)
  return {
    count: rows.length,
    due: roundMoney(due),
    paid: roundMoney(paid),
    openAmount: roundMoney(due - paid),
    openCount: entries.filter((entry) => !entry.paid).length,
    byCategory: [...byCategory.values()]
      .map((item) => ({ ...item, amount: roundMoney(item.amount) }))
      .sort((a, b) => b.amount - a.amount),
    entries: entries.slice(0, 60),
  }
}

const dayCache = new Map()
const rawCache = new Map()
const RAW_CACHE_LIMIT = 90

function rememberRaw(key, rows) {
  if (rawCache.has(key)) rawCache.delete(key)
  rawCache.set(key, rows)
  while (rawCache.size > RAW_CACHE_LIMIT) {
    const oldest = rawCache.keys().next().value
    rawCache.delete(oldest)
  }
}

const KITCHEN_STAGES = ['Cozinha', 'Aguardando Entrega', 'Saiu para entrega', 'Entregue', 'Finalizado', 'Cancelados']
const ACTIVE_KITCHEN_STAGES = new Set(['Cozinha', 'Aguardando Entrega', 'Saiu para entrega'])
const URGENT_KITCHEN_MINUTES = 15

function fortalezaTimestamp(value) {
  const raw = text(value)
  if (!raw) return null
  const timestamp = Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}-03:00`)
  return Number.isFinite(timestamp) ? timestamp : null
}

function shortSaleCode(value) {
  const normalized = label(value).replace(/[^a-zA-Z0-9]/g, '')
  return normalized ? normalized.slice(-6).toUpperCase() : '—'
}

/** Último status, duração e fila operacional. Sem nome, telefone ou endereço de cliente. */
function summarizeKitchen(rows) {
  const current = new Map()
  const stages = new Map()
  const dailyCookingSeconds = new Map()
  const queue = []
  const now = Date.now()

  for (const row of rows) {
    const steps = (Array.isArray(row.histories) ? row.histories : [])
      .slice()
      .sort((a, b) => num(a.order) - num(b.order))
    const lastName = text(steps[steps.length - 1]?.desc_store_sale_status) || 'Sem status'
    const firstStep = steps[0]
    const status = current.get(lastName) || { label: lastName, count: 0 }
    status.count += 1
    current.set(lastName, status)

    if (ACTIVE_KITCHEN_STAGES.has(lastName)) {
      const kitchenStep = steps.find((step) => text(step.desc_store_sale_status) === 'Cozinha')
        || steps.find((step) => ACTIVE_KITCHEN_STAGES.has(text(step.desc_store_sale_status)))
        || firstStep
      const enteredAt = fortalezaTimestamp(kitchenStep?.created_at)
      const waitingMinutes = enteredAt === null ? null : Math.max(0, Math.floor((now - enteredAt) / 60000))
      queue.push({
        code: shortSaleCode(row.id_sale),
        channel: 'outros',
        status: lastName,
        enteredAt: text(kitchenStep?.created_at) || null,
        waitingMinutes,
        urgent: typeof waitingMinutes === 'number' && waitingMinutes >= URGENT_KITCHEN_MINUTES,
      })
    }

    for (const step of steps) {
      const name = text(step.desc_store_sale_status) || 'Sem status'
      const stage = stages.get(name) || { label: name, count: 0, seconds: [] }
      stage.count += 1
      const seconds = Number(step.duration_time_seconds)
      if (Number.isFinite(seconds) && seconds >= 0) {
        stage.seconds.push(seconds)
        if (name === 'Cozinha' && seconds > 0) {
          const day = text(row.shift_date).slice(0, 10)
            || text(row.created_at).slice(0, 10)
            || text(step.created_at).slice(0, 10)
          if (day) {
            const values = dailyCookingSeconds.get(day) || []
            values.push(seconds)
            dailyCookingSeconds.set(day, values)
          }
        }
      }
      stages.set(name, stage)
    }
  }

  const countOf = (label) => current.get(label)?.count || 0
  const ordered = (map, mapItem) => [
    ...KITCHEN_STAGES.filter((label) => map.has(label)).map((label) => mapItem(map.get(label))),
    ...[...map.values()].filter((item) => !KITCHEN_STAGES.includes(item.label)).map(mapItem),
  ]
  const preparing = countOf('Cozinha')
  const waiting = countOf('Aguardando Entrega')
  const onTheWay = countOf('Saiu para entrega')
  queue.sort((a, b) => (b.waitingMinutes ?? -1) - (a.waitingMinutes ?? -1) || a.code.localeCompare(b.code))
  return {
    total: rows.length,
    preparing,
    waiting,
    onTheWay,
    finished: countOf('Finalizado') + countOf('Entregue'),
    canceled: countOf('Cancelados'),
    active: preparing + waiting + onTheWay,
    urgent: queue.filter((item) => item.urgent).length,
    urgentAfterMinutes: URGENT_KITCHEN_MINUTES,
    queue,
    dailyKitchenMinutes: Object.fromEntries(
      [...dailyCookingSeconds.entries()].map(([day, seconds]) => [day, durationStats(seconds).averageMinutes]),
    ),
    current: ordered(current, (item) => ({ label: item.label, count: item.count })),
    stages: ordered(stages, (item) => ({
      label: item.label,
      count: item.count,
      ...durationStats(item.seconds),
    })),
  }
}

const CATEGORIES = {
  cozinha: {
    path: '/sales_status_histories',
    filter: 'shift_date',
    // Uma página maior evita dezenas de chamadas para o mesmo turno.
    pageSize: 100,
    maxPages: 6,
    summarize: (rows) => summarizeKitchen(rows),
  },
  faturamento: { path: '/search_sales', filter: 'shift_date', summarize: (rows) => summarizeSales(rows) },
  itens: { path: '/sales_items', filter: 'shift_date', summarize: (rows) => summarizeItems(rows) },
  entregas: { path: '/search_sales', filter: 'shift_date', summarize: (rows) => summarizeDeliveries(rows) },
  financeiro: { path: '/search_financial_transactions', filter: 'date', summarize: (rows) => summarizeFinance(rows) },
}

async function loadOneDay(spec, day, token, signal, fresh = false, cacheScope = 'dirceu') {
  const key = `${cacheScope}:${spec.path}:${spec.filter}:${day}`
  if (!fresh && rawCache.has(key)) return rawCache.get(key)
  const rows = []
  for await (const page of saiposPages(
    spec.path,
    { p_date_column_filter: spec.filter, ...dayRange(day, day) },
    token,
    signal,
    spec.maxPages || 2,
    spec.pageSize || PAGE_SIZE,
  )) {
    rows.push(...page.batch)
    if (page.last) break
  }
  rememberRaw(key, rows)
  return rows
}

async function* loadRangeSteps(spec, start, end, token, signal, fresh = false, cacheScope = 'dirceu') {
  const days = eachDay(start, end)
  const rows = []
  for (const [index, day] of days.entries()) {
    if (signal?.aborted) throw new DOMException('Consulta cancelada.', 'AbortError')
    // Um dia por vez. Disparar o mês inteiro junto estoura o limite da Saipos.
    const batch = await loadOneDay(spec, day, token, signal, fresh && day === end, cacheScope)
    rows.push(...batch)
    yield { rows: rows.slice(), partial: index < days.length - 1 }
  }
}

async function* streamDirceuReport(day, period, category, token, signal, fresh = false, unit = 'Dirceu', cacheScope = 'dirceu') {
  const spec = CATEGORIES[category]
  const bounds = periodBounds(day, period, todayInFortaleza())
  const key = `${cacheScope}:${bounds.start}:${bounds.end}:${category}`
  const cached = fresh ? null : dayCache.get(key)
  if (cached) {
    yield { status: 200, body: { ...cached, partial: false } }
    return
  }

  let latest = null
  try {
    for await (const step of loadRangeSteps(spec, bounds.start, bounds.end, token, signal, fresh, cacheScope)) {
      latest = reportBody(day, period, bounds, category, step.rows, spec.summarize, step.partial, unit)
      yield { status: 200, body: latest }
      if (!step.partial && !signal?.aborted) dayCache.set(key, latest)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    const message = error instanceof Error ? error.message : 'Falha na consulta.'
    if (!latest) {
      yield { status: 503, body: { error: message, date: day, period, ...bounds, unit, category } }
      return
    }
    yield { status: 200, body: { ...latest, partial: false, error: message } }
  }
}

/** Entrega cada página assim que a Saipos responde, sem esperar o período inteiro. */
export async function pipeDirceuReport(date, category, token, signal, period = 'dia', response, fresh = false, unit = 'Dirceu', cacheScope = 'dirceu') {
  const day = date || todayInFortaleza()
  const span = period === 'semana' || period === 'mes' ? period : 'dia'
  if (!isIsoDate(day)) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ error: 'Informe o dia no formato AAAA-MM-DD.' }))
    return
  }
  if (!CATEGORIES[category]) {
    response.statusCode = 400
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ error: 'Escolha cozinha, faturamento, itens, entregas ou financeiro.' }))
    return
  }
  if (!normalizeToken(token)) {
    response.statusCode = 500
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ error: 'A chave da Saipos não está configurada no servidor.' }))
    return
  }

  let opened = false
  try {
    for await (const event of streamDirceuReport(day, span, category, token, signal, fresh, unit, cacheScope)) {
      if (signal?.aborted || response.writableEnded) return
      if (!opened && event.status !== 200) {
        response.statusCode = event.status
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify(event.body))
        return
      }
      if (!opened) {
        response.statusCode = 200
        response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
        response.setHeader('Cache-Control', 'no-cache, no-transform')
        response.setHeader('X-Accel-Buffering', 'no')
        if (typeof response.flushHeaders === 'function') response.flushHeaders()
        opened = true
      }
      response.write(`${JSON.stringify(event.body)}\n`)
    }
    if (opened && !response.writableEnded) response.end()
  } catch (error) {
    if (response.writableEnded || signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      if (!response.writableEnded) response.end()
      return
    }
    if (!opened) {
      response.statusCode = 500
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ error: 'Falha ao consultar a operação do Dirceu.' }))
      return
    }
    response.write(`${JSON.stringify({ error: 'Falha ao consultar a operação do Dirceu.', partial: false })}\n`)
    response.end()
  }
}

/** Carrega o resumo final para telas consolidadas, sem expor pedidos ou dados de clientes. */
export async function getSaiposReport({ date, category, token, signal, period = 'dia', fresh = false, unit = 'Dirceu', cacheScope = 'dirceu' }) {
  const day = date || todayInFortaleza()
  const span = period === 'semana' || period === 'mes' ? period : 'dia'
  if (!isIsoDate(day)) throw new Error('Informe o dia no formato AAAA-MM-DD.')
  if (!CATEGORIES[category]) throw new Error('Categoria Saipos inválida.')
  if (!normalizeToken(token)) throw new Error(`A chave da Saipos para ${unit} não está configurada no servidor.`)

  let latest = null
  for await (const event of streamDirceuReport(day, span, category, token, signal, fresh, unit, cacheScope)) {
    if (event.status !== 200) throw new Error(event.body.error || 'Falha na consulta.')
    latest = event.body
  }
  if (!latest) throw new Error('A Saipos não devolveu dados para esta consulta.')
  return latest
}

/** Número da mesa quando a Saipos envia o texto. O id interno da mesa não é o número da casa. */
function visibleTableNumber(row) {
  const table = row.table_order && typeof row.table_order === 'object' ? row.table_order : {}
  const direct = [
    table.desc_store_table,
    table.desc_table,
    table.number,
    table.table_number,
    table.cod_table,
    table.integration_code,
  ].map((value) => label(value)).find((value) => value && value !== '0')
  if (direct) return direct.replace(/^mesa\s*/i, '')
  const description = text(row.desc_sale)
  const named = description.match(/^(?:mesa|comanda)\s*(\d{1,4})$/i)
  if (named) return named[1]
  if (/^\d{1,4}$/.test(description)) return description
  return ''
}

/**
 * Cruza a fila de status com as vendas do turno. O endpoint de histórico não
 * devolve o tipo de atendimento nem o número visível.
 */
export async function getSaiposKdsOrderDetails({ date, token, signal, fresh = false, cacheScope = 'dirceu' }) {
  const rows = await loadOneDay(CATEGORIES.faturamento, date, token, signal, fresh, cacheScope)
  return new Map(rows.map((row) => {
    const code = shortSaleCode(row.id_sale)
    const saleType = num(row.id_sale_type)
    const saleNumber = label(row.sale_number)
    const partner = row.partner_sale && typeof row.partner_sale === 'object' ? row.partner_sale : null
    const partnerNumber = label(partner?.cod_sale2)
    const tableStatus = num(row.table_order?.id_table_order_status)
    const include = !isCanceledSale(row) && (saleType !== 3 || tableStatus !== 1)
    const ticket = row.ticket && typeof row.ticket === 'object'
      ? label(row.ticket.number) || label(row.ticket.service_ticket_number)
      : label(row.ticket)

    if (saleType === 1) {
      const number = saleNumber || partnerNumber
      return [code, {
        channel: 'delivery',
        label: number ? `#${number}` : '#',
        reference: '',
        include,
      }]
    }
    if (saleType === 3) {
      const tableNumber = visibleTableNumber(row)
      return [code, { channel: 'mesa', label: tableNumber ? `Mesa ${tableNumber}` : 'Mesa', reference: '', include }]
    }
    if (saleType === 2) return [code, { channel: 'outros', label: saleNumber ? `Balcão #${saleNumber}` : 'Balcão', include }]
    if (saleType === 4) return [code, { channel: 'outros', label: ticket ? `Ficha #${ticket}` : 'Ficha', include }]
    return [code, { channel: 'outros', label: `#${code}`, include }]
  }))
}

/**
 * Vendas e tempo da competição no mesmo recorte: entrega e salão, sem canceladas.
 * O histórico de status não traz o tipo da venda, então o tempo só entra se o
 * id_sale existir numa venda de mesa ou delivery. Cada venda pesa uma vez.
 * A consulta é por dia porque a Saipos recusa um intervalo maior que 15 dias.
 */
export async function getSaiposCompetitionMetrics({ start, end, token, signal, fresh = false, cacheScope = 'dirceu' }) {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) throw new Error('Informe um intervalo de datas válido.')
  if (!normalizeToken(token)) throw new Error('A chave da Saipos não está configurada no servidor.')

  const days = eachDay(start, end)
  const loaded = []
  for (const day of days) {
    if (signal?.aborted) throw new DOMException('Consulta cancelada.', 'AbortError')
    const refreshDay = fresh && day === end
    const sales = await loadOneDay(CATEGORIES.faturamento, day, token, signal, refreshDay, cacheScope)
    const histories = await loadOneDay(CATEGORIES.cozinha, day, token, signal, refreshDay, cacheScope)
    loaded.push({ day, sales, histories })
  }

  const counts = new Map()
  const dailyKitchenMinutes = {}
  const allSeconds = []
  for (const { day, sales, histories } of loaded) {
    const allowed = new Set()
    let count = 0
    for (const row of sales) {
      if (!isCompetitionSale(row)) continue
      count += 1
      const key = saleKey(row.id_sale)
      if (key) allowed.add(key)
    }
    counts.set(day, count)

    const daySeconds = []
    for (const row of histories) {
      if (!allowed.has(saleKey(row.id_sale))) continue
      const seconds = competitionKitchenSeconds(row)
      if (seconds === null) continue
      daySeconds.push(seconds)
      allSeconds.push(seconds)
    }
    const average = durationStats(daySeconds).averageMinutes
    if (typeof average === 'number') dailyKitchenMinutes[day] = average
  }

  return {
    counts,
    averageMinutes: durationStats(allSeconds).averageMinutes,
    dailyKitchenMinutes,
  }
}

/**
 * Conta entrega e salão de cada dia, sem canceladas, balcão ou ficha.
 */
export async function getSaiposDailySalesCounts({ start, end, token, signal, fresh = false, cacheScope = 'dirceu' }) {
  const { counts } = await getSaiposCompetitionMetrics({ start, end, token, signal, fresh, cacheScope })
  return counts
}
