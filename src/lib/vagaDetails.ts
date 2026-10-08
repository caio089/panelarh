/** Converte texto com bullets/linhas em lista limpa para UI */
export function linesFromText(value?: string | null): string[] {
  if (!value?.trim()) return []
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•\-*]+/, '').trim())
    .filter(Boolean)
}
