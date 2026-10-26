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

const STAFF_SESSION_IDS = new Set(['demo-admin', 'demo-rh'])

export function isAdminRequest(req) {
  return staffIdFromCookie(req?.headers?.cookie) === ADMIN_SESSION_ID
}

/** Admin e RH podem pedir a seleção. A Saipos continua só com o admin. */
export function isStaffRequest(req) {
  return STAFF_SESSION_IDS.has(staffIdFromCookie(req?.headers?.cookie))
}
