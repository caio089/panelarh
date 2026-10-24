export const SAIPOS_UNITS = {
  dirceu: { id: 'dirceu', name: 'Dirceu', token: () => process.env.API_SAIPOS ?? '' },
  promorar: { id: 'promorar', name: 'Promorar', token: () => process.env.API_SAIPOS_PROMORAR ?? '' },
  mocambinho: { id: 'mocambinho', name: 'Mocambinho', token: () => process.env.API_SAIPOS_MOCAMBINHO ?? '' },
}

export function saiposUnit(id) {
  return SAIPOS_UNITS[id] ?? null
}
