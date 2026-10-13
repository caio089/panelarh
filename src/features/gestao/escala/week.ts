import { addDays, parseISODate, startOfToday, toISODate } from '../dateUtils'
import type { ScheduleDayIndex } from '../types'

/** Segunda-feira da semana que contém a data. */
export function getWeekStart(date: Date = startOfToday()): string {
  const offset = (date.getDay() + 6) % 7
  return toISODate(addDays(date, -offset))
}

export function shiftWeek(weekStart: string, weeks: number): string {
  return toISODate(addDays(parseISODate(weekStart), weeks * 7))
}

export function dayDate(weekStart: string, day: ScheduleDayIndex): Date {
  return addDays(parseISODate(weekStart), day)
}

export function formatWeekRange(weekStart: string): string {
  const start = parseISODate(weekStart)
  const end = addDays(start, 6)
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
  return `${fmt(start)} – ${fmt(end)}`
}

export function isValidWeekStart(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return parseISODate(value).getDay() === 1
}
