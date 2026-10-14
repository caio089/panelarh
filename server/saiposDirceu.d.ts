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
): Promise<void>
