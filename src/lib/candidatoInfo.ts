/** Extrai WhatsApp e monta blocos legíveis a partir da candidatura pública. */

export function phoneFromCandidatoInfo(info?: string | null, profilePhone?: string | null) {
  if (profilePhone?.trim()) return profilePhone.trim()
  if (!info) return null
  const match = info.match(/WhatsApp:\s*([^\n·]+)/i)
  return match?.[1]?.trim() || null
}

export function rowsFromCandidatoInfo(info?: string | null): Array<[string, string]> {
  if (!info?.trim()) return []
  return info
    .split(/\n|·/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(':')
      if (idx === -1) return ['Info', part] as [string, string]
      return [part.slice(0, idx).trim(), part.slice(idx + 1).trim()] as [string, string]
    })
    .filter(([, value]) => Boolean(value))
}
