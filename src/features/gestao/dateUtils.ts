const DAY_MS = 24 * 60 * 60 * 1000

/** Data local (meia-noite) de hoje. */
export function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Converte para yyyy-mm-dd usando o fuso local (evita deslocamento do toISOString). */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS)
}

/** Converte "HH:mm" + deslocamento em minutos para "HH:mm". */
export function shiftTime(hhmm: string, offsetMin: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (((h * 60 + m + offsetMin) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Tempo de casa legível a partir da data de admissão. */
export function tenureLabel(admissao: string): string {
  const months = Math.max(0, Math.round(daysBetween(parseISODate(admissao), startOfToday()) / 30.44))
  if (months < 1) return 'recém-contratado'
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'} de casa`
  const years = Math.floor(months / 12)
  return `${years} ano${years > 1 ? 's' : ''} de casa`
}

export function formatShortDate(iso: string): string {
  const date = parseISODate(iso)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}
