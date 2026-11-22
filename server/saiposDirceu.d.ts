export function pipeDirceuReport(
  date: string,
  category: string,
  accessToken: string,
  signal: AbortSignal | undefined,
  period: string | undefined,
  response: {
    statusCode: number
    writableEnded: boolean
    setHeader(name: string, value: string): void
    flushHeaders?: () => void
    write(chunk: string): boolean
    end(chunk?: string): void
  },
  fresh?: boolean,
): Promise<void>

type CompetitionSourceOptions = {
  token: string
  signal?: AbortSignal
  fresh?: boolean
  cacheScope?: string
}

export function getSaiposCompetitionSales(options: CompetitionSourceOptions & { date: string }): Promise<number>

export function getSaiposCompetitionMetrics(options: CompetitionSourceOptions & {
  start: string
  end: string
  freshSales?: boolean
}): Promise<{
  counts: Map<string, number>
  averageMinutes: number | null
  dailyKitchenMinutes: Record<string, number>
  dailyKitchenTotals: Record<string, { seconds: number; samples: number }>
}>
