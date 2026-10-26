/** Rotas que o RH pode abrir. Qualquer outro /admin fica só para o admin. */
const RH_AREAS = ['/admin/rh', '/admin/pessoas', '/admin/colaboradores', '/admin/vagas', '/admin/quadro', '/admin/candidatos', '/admin/selecao', '/admin/acesso']

export function isRhArea(pathname: string) {
  return RH_AREAS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export function staffHome(isRh: boolean) {
  return isRh ? '/admin/rh' : '/admin'
}
