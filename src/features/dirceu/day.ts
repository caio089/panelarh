const TIME_ZONE = 'America/Fortaleza'

export function todayInFortaleza(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now)
}

export function isIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function shiftIsoDate(iso: string, delta: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + delta)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export type DirceuPeriod = 'dia' | 'semana' | 'mes'

export function isDirceuPeriod(value: string | null): value is DirceuPeriod {
  return value === 'dia' || value === 'semana' || value === 'mes'
}

function utcDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function shiftMonth(iso: string, delta: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + delta, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, last))
  return formatUtc(target)
}

function startOfWeek(iso: string): string {
  const date = utcDate(iso)
  const weekday = date.getUTCDay()
  const delta = weekday === 0 ? -6 : 1 - weekday
  date.setUTCDate(date.getUTCDate() + delta)
  return formatUtc(date)
}

function monthEnd(iso: string): string {
  const [year, month] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${iso.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

export function periodBounds(anchor: string, period: DirceuPeriod, today = todayInFortaleza()): { start: string; end: string } {
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

export function moveAnchor(anchor: string, period: DirceuPeriod, delta: number): string {
  if (period === 'mes') return shiftMonth(anchor, delta)
  if (period === 'semana') return shiftIsoDate(anchor, delta * 7)
  return shiftIsoDate(anchor, delta)
}

export function formatRangeLabel(start: string, end: string): string {
  if (start === end) return formatDayLabel(start)
  const startDate = utcDate(start)
  const endDate = utcDate(end)
  if (start.slice(0, 7) === end.slice(0, 7)) {
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(endDate)
    return `${startDate.getUTCDate()} a ${endDate.getUTCDate()} de ${month}`
  }
  const full = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  return `${full.format(startDate)} a ${full.format(endDate)}`
}

export function formatDayLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(year, month - 1, day),
  )
  return label.charAt(0).toLocaleUpperCase('pt-BR') + label.slice(1)
}
