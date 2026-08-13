/** Perguntas do formulário "Vem trabalhar com a gente!" (sem anexo de currículo). */

export const FORM_SHIFTS = ['Manhã', 'Tarde', 'Noite', 'Madrugada'] as const

export const YES_NO = ['Sim', 'Não'] as const

export type FormShift = (typeof FORM_SHIFTS)[number]
export type YesNo = (typeof YES_NO)[number]
