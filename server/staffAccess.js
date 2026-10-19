/** Só a sessão do admin libera a consulta da Saipos. O valor é o id da conta demo. */
const ADMIN_SESSION_ID = 'demo-admin'

export function staffIdFromCookie(header) {
  const raw = typeof header === 'string' ? header : ''
  const match = raw.match(/(?:^|;\s*)panela-staff=([^;]*)/)
  if (!match) return ''
  try {
    return decodeURIComponent(match[1])
  } catch {
    return ''
  }
}

export function isAdminRequest(req) {
  return staffIdFromCookie(req?.headers?.cookie) === ADMIN_SESSION_ID
}
