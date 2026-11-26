import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

export type ReportKind = 'espelho' | 'banco'
export interface DayRecord {
  date: string
  punches: string[]
  entry: string | null
  expectedEntry: string | null
  workedMinutes: number | null
  status: 'ok' | 'sem_batida' | 'incompleto'
}
export interface ReportPerson {
  sourceName: string
  collaboratorId: string | null
  days: DayRecord[]
  balanceMinutes: number | null
  periodMinutes: number | null
  positiveMinutes: number | null
  negativeMinutes: number | null
}
export interface ParsedReport {
  kind: ReportKind
  from: string
  to: string
  company: string
  people: ReportPerson[]
}
interface PdfItem { str: string; transform: number[] }
interface PdfLine { y: number; items: PdfItem[]; text: string }

const dateIso = (value: string) => {
  const [day, month, year] = value.split('/').map(Number)
  return `${year < 100 ? 2000 + year : year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
export function minutes(value: string): number | null {
  const match = /^(-?)(\d{1,3}):(\d{2})$/.exec(value.trim())
  return match ? (match[1] ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : null
}
export function formatMinutes(value: number | null, signed = false): string {
  if (value === null) return '—'
  const prefix = value < 0 ? '-' : signed && value > 0 ? '+' : ''
  return `${prefix}${String(Math.floor(Math.abs(value) / 60)).padStart(2, '0')}:${String(Math.abs(value) % 60).padStart(2, '0')}`
}
export function normalizeName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
}
function lines(items: PdfItem[]): PdfLine[] {
  const result: PdfLine[] = []
  for (const item of items) {
    if (!item.str.trim()) continue
    const y = item.transform[5]
    let line = result.find((row) => Math.abs(row.y - y) < 2)
    if (!line) { line = { y, items: [], text: '' }; result.push(line) }
    line.items.push(item)
  }
  return result.sort((a, b) => b.y - a.y).map((line) => {
    line.items.sort((a, b) => a.transform[4] - b.transform[4])
    line.text = line.items.map((item) => item.str).join(' ').replace(/\s+/g, ' ').trim()
    return line
  })
}
function afterLabel(text: string, label: RegExp, next?: RegExp) {
  const match = label.exec(text)
  if (!match) return ''
  const tail = text.slice(match.index + match[0].length)
  return (next ? tail.split(next)[0] : tail).trim()
}
function pagePerson(rows: PdfLine[], kind: ReportKind): ReportPerson {
  const header = rows.find((row) => kind === 'espelho' ? /\bNOME:\s/.test(row.text) : /NOME DO FUNCIONÁRIO:/.test(row.text))?.text ?? ''
  const sourceName = kind === 'espelho'
    ? afterLabel(header, /\bNOME:\s*/, /PIS\/PASEP:/)
    : afterLabel(header, /NOME DO FUNCIONÁRIO:\s*/, /PIS DO FUNCIONÁRIO:/)
  if (!sourceName) throw new Error('Não foi possível identificar o nome em uma página do relatório.')
  const person: ReportPerson = { sourceName, collaboratorId: null, days: [], balanceMinutes: null, periodMinutes: null, positiveMinutes: null, negativeMinutes: null }
  if (kind === 'banco') {
    const row = rows.find((line) => /^\d{2}\/\d{2}\/\d{4}\s+ATÉ\s+\d{2}\/\d{2}\/\d{4}/i.test(line.text))
    const values = row?.text.match(/-?\d{1,3}:\d{2}/g) ?? []
    if (values.length !== 5) throw new Error(`Saldo ilegível para ${sourceName}.`)
    person.periodMinutes = minutes(values[0]); person.positiveMinutes = minutes(values[1])
    person.negativeMinutes = minutes(values[2]); person.balanceMinutes = minutes(values[4])
    return person
  }
  const headerRow = rows.find((row) => row.text.includes('ENT. 1') && row.text.includes('DURA'))
  const entryX = headerRow?.items.find((item) => item.str.includes('ENT. 1'))?.transform[4] ?? 185
  const durationX = headerRow?.items.find((item) => item.str.includes('DURA'))?.transform[4] ?? 340
  const contractIndex = rows.findIndex((row) => row.text.includes('CÓDIGO DO HORÁRIO'))
  const contracts = new Map<string, string>()
  for (const row of rows.slice(contractIndex + 1)) {
    const code = row.items.find((item) => /^\d{5}$/.test(item.str.trim()))?.str.trim()
    const times = row.items.filter((item) => /^\d{2}:\d{2}$/.test(item.str.trim())).map((item) => item.str.trim())
    if (code && times.length >= 2) contracts.set(code, times[0])
  }
  for (const row of rows) {
    const day = /^(\d{2}\/\d{2}\/\d{2})\s*-\s*[A-Z]{3}/.exec(row.text)
    if (!day) continue
    const code = row.items.find((item) => /^\d{5}$/.test(item.str.trim()))?.str.trim()
    const punches = row.items.filter((item) => item.transform[4] < entryX - 4 && item.str.includes(':'))
      .flatMap((item) => item.str.match(/\d{2}:\d{2}/g) ?? [])
    const actual = row.items.filter((item) => item.transform[4] >= entryX - 4 && item.transform[4] < durationX - 4 && /^\d{2}:\d{2}$/.test(item.str.trim()))
      .map((item) => item.str.trim())
    const workedText = row.items.find((item) => item.transform[4] >= durationX - 4 && item.transform[4] < durationX + 45 && /^\d{2}:\d{2}$/.test(item.str.trim()))?.str.trim()
    const workedMinutes = workedText ? minutes(workedText) : null
    person.days.push({
      date: dateIso(day[1]), punches, entry: workedMinutes !== null ? actual[0] ?? null : null,
      expectedEntry: code ? contracts.get(code) ?? null : null, workedMinutes,
      status: workedMinutes !== null ? 'ok' : punches.length || actual.length ? 'incompleto' : 'sem_batida',
    })
  }
  return person
}
export async function parseTimeReport(file: File): Promise<ParsedReport> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  try {
    if (pdf.numPages > 300) throw new Error('Relatório grande demais. Separe por unidade ou período.')
    const people: ReportPerson[] = []
    let kind: ReportKind | null = null, from = '', to = '', company = ''
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo)
      const content = await page.getTextContent()
      const rows = lines(content.items as PdfItem[])
      const text = rows.map((row) => row.text).join('\n')
      const pageKind = /Extrato Banco Horas/i.test(text) ? 'banco' : /Ponto Eletrônico/i.test(text) ? 'espelho' : null
      if (!pageKind || kind && kind !== pageKind) throw new Error('O PDF precisa ser um espelho de ponto ou extrato de banco de horas do sistema.')
      kind = pageKind
      const period = /DE\s+(\d{2}\/\d{2}\/\d{4})\s+ATÉ\s+(\d{2}\/\d{2}\/\d{4})/i.exec(text)
      if (!period) throw new Error('Período não encontrado no relatório.')
      if (from && (from !== dateIso(period[1]) || to !== dateIso(period[2]))) throw new Error('O PDF mistura períodos diferentes.')
      from = dateIso(period[1]); to = dateIso(period[2])
      const companyRow = rows.find((row) => pageKind === 'espelho' ? /^EMPRESA:/.test(row.text) : /^NOME DA EMPRESA:/.test(row.text))?.text ?? ''
      company ||= pageKind === 'espelho' ? afterLabel(companyRow, /^EMPRESA:\s*/, /CNPJ:/) : afterLabel(companyRow, /^NOME DA EMPRESA:\s*/)
      people.push(pagePerson(rows, pageKind))
    }
    if (!kind || !people.length) throw new Error('O PDF não contém colaboradores.')
    return { kind, from, to, company, people }
  } finally { pdf.destroy() }
}
export function lateness(day: DayRecord, tolerance = 0): number | null {
  if (!day.entry || !day.expectedEntry) return null
  const actual = minutes(day.entry), expected = minutes(day.expectedEntry)
  return actual === null || expected === null ? null : Math.max(0, actual - expected - tolerance)
}
