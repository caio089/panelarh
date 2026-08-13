/** Rascunho de vaga gerado a partir do cargo — o RH revisa antes de publicar. */

export type VagaAiDraft = {
  descricao: string
  localidade: string
  horario: string
  salario: string
  responsabilidades: string
  requisitos: string
  diferenciais: string
  beneficios: string
}

type RolePack = {
  match: (title: string) => boolean
  descricao: (titulo: string, casa: string) => string
  responsabilidades: string[]
  requisitos: string[]
  diferenciais: string[]
  horario: string
  salario: string
}

const BENEFICIOS_CASA = [
  'Alimentação no local',
  'Vale-transporte',
  'Uniforme fornecido',
  'Ambiente de crescimento na Panela Velha',
]

function bullets(items: string[]) {
  return items.map((item) => `• ${item}`).join('\n')
}

function casaLabel(unitName?: string) {
  return unitName?.trim() || 'nossa casa'
}

const ROLES: RolePack[] = [
  {
    match: (t) => /chapeiro|chapa|grill/.test(t),
    descricao: (titulo, casa) =>
      `Vaga de ${titulo} na ${casa}. Responsável pela produção na chapa, padronização dos pratos e ritmo de casa cheia, com foco em qualidade e segurança alimentar.`,
    responsabilidades: [
      'Preparar e montar os pratos da chapa com padrão da casa',
      'Controlar ponto, temperatura e apresentação',
      'Manter a estação organizada, limpa e abastecida',
      'Seguir fichas técnicas e boas práticas de higiene',
      'Apoiar o time da cozinha nos horários de pico',
    ],
    requisitos: [
      'Experiência prévia em chapa, grill ou cozinha de volume',
      'Disponibilidade para turnos e finais de semana',
      'Agilidade, organização e trabalho em equipe',
      'Cuidados com higiene e segurança alimentar',
    ],
    diferenciais: ['Conhecimento de fichas técnicas', 'Experiência em restaurante de alto movimento'],
    horario: 'Escala 6x1 · turnos de 8h (manhã, tarde ou noite)',
    salario: 'A combinar + benefícios',
  },
  {
    match: (t) => /cozinheir|chef|pizzaiolo|pizzaria/.test(t),
    descricao: (titulo, casa) =>
      `Vaga de ${titulo} na ${casa}. Produção com padrão Panela Velha: sabor, apresentação e consistência em todos os pratos.`,
    responsabilidades: [
      'Preparar pratos conforme o cardápio e as fichas técnicas',
      'Organizar mise en place e controlar validade dos insumos',
      'Manter a cozinha limpa e segura',
      'Apoiar o time nos horários de pico',
      'Sinalizar faltas de estoque com antecedência',
    ],
    requisitos: [
      'Experiência em cozinha de restaurante',
      'Disponibilidade para finais de semana',
      'Boas práticas de higiene e organização',
    ],
    diferenciais: ['Curso de gastronomia ou similar', 'Experiência com cardápio regional'],
    horario: 'Escala 6x1 · turnos de 8h',
    salario: 'A combinar + benefícios',
  },
  {
    match: (t) => /auxiliar de cozinha|aux\.?\s*cozinha|lavador|steward/.test(t),
    descricao: (titulo, casa) =>
      `Vaga de ${titulo} na ${casa}. Apoio à produção, organização e limpeza para o time da cozinha render com qualidade.`,
    responsabilidades: [
      'Apoiar mise en place e pré-preparo',
      'Manter louças, utensílios e área de apoio em ordem',
      'Abastecer estações durante o serviço',
      'Seguir normas de higiene e segurança',
    ],
    requisitos: [
      'Vontade de aprender e ritmo de trabalho',
      'Disponibilidade para turnos e finais de semana',
      'Organização e cuidado com o ambiente',
    ],
    diferenciais: ['Experiência prévia em restaurante', 'Disponibilidade imediata'],
    horario: 'Escala 6x1 · turnos de 8h',
    salario: 'A combinar + benefícios',
  },
  {
    match: (t) => /gar[cç]om|atendente|sal[aã]o|hostess|recepcion/.test(t),
    descricao: (titulo, casa) =>
      `Vaga de ${titulo} na ${casa}. Atendimento caloroso, hospitalidade e ritmo de casa cheia — a experiência do cliente começa na sua mesa.`,
    responsabilidades: [
      'Receber, anotar pedidos e conduzir o atendimento com cordialidade',
      'Conhecer o cardápio e sugerir pratos quando fizer sentido',
      'Manter mesas organizadas e o salão pronto para o próximo cliente',
      'Trabalhar em parceria com cozinha e caixa',
      'Cuidar da experiência do início ao fim da visita',
    ],
    requisitos: [
      'Boa comunicação e simpatia',
      'Disponibilidade para finais de semana e feriados',
      'Agilidade e trabalho em equipe',
    ],
    diferenciais: ['Experiência em restaurante ou bar', 'Conhecimento de cardápio e vinhos'],
    horario: 'Escala 6x1 · turnos de 8h (almoço e/ou jantar)',
    salario: 'A combinar + gorjetas + benefícios',
  },
  {
    match: (t) => /caixa|operador de caixa|balc[aã]o/.test(t),
    descricao: (titulo, casa) =>
      `Vaga de ${titulo} na ${casa}. Atendimento no caixa com precisão, cordialidade e fila andando — a última impressão também conta.`,
    responsabilidades: [
      'Registrar pedidos e receber pagamentos com atenção',
      'Conferir caixa no início e no fim do turno',
      'Atender o cliente com clareza e simpatia',
      'Apoiar o fluxo do salão nos horários de pico',
    ],
    requisitos: [
      'Atenção a números e organização',
      'Boa comunicação',
      'Disponibilidade para turnos e finais de semana',
    ],
    diferenciais: ['Experiência com PDV ou sistemas de restaurante', 'Noções de fechamento de caixa'],
    horario: 'Escala 6x1 · turnos de 8h',
    salario: 'A combinar + benefícios',
  },
  {
    match: (t) => /gerente|l[ií]der|supervisor|coordenador/.test(t),
    descricao: (titulo, casa) =>
      `Vaga de ${titulo} na ${casa}. Liderança da operação, gente e indicadores — para a casa funcionar com padrão, ritmo e hospitalidade.`,
    responsabilidades: [
      'Liderar a equipe do salão e/ou cozinha no dia a dia',
      'Acompanhar qualidade, tempo de serviço e experiência do cliente',
      'Controlar escala, ponto e clima do time',
      'Cuidar de estoque, custos e rotinas da unidade',
      'Resolver ocorrências e manter o padrão Panela Velha',
    ],
    requisitos: [
      'Experiência em liderança de restaurante ou operação similar',
      'Disponibilidade para horários de operação (incluindo FDS)',
      'Boa comunicação, organização e tomada de decisão',
    ],
    diferenciais: ['Indicadores de loja (CMV, ticket, NPS)', 'Experiência com múltiplos turnos'],
    horario: 'Escala da operação · flexível conforme a casa',
    salario: 'A combinar + benefícios',
  },
  {
    match: (t) => /motoboy|entregador|delivery/.test(t),
    descricao: (titulo, casa) =>
      `Vaga de ${titulo} na ${casa}. Entregas rápidas e cuidadosas, com boa apresentação e respeito ao cliente.`,
    responsabilidades: [
      'Retirar pedidos e entregar no prazo combinado',
      'Conferir volumes antes de sair',
      'Cuidar da apresentação e do contato com o cliente',
      'Manter o veículo em condições de uso',
    ],
    requisitos: [
      'CNH válida na categoria exigida',
      'Veículo próprio em bom estado (quando aplicável)',
      'Disponibilidade para horários de pico e finais de semana',
    ],
    diferenciais: ['Experiência com apps de entrega', 'Conhecimento da cidade'],
    horario: 'Turnos de almoço e/ou jantar · finais de semana',
    salario: 'A combinar + taxas de entrega',
  },
  {
    match: (t) => /limpeza|servi[cç]os gerais|faxine/.test(t),
    descricao: (titulo, casa) =>
      `Vaga de ${titulo} na ${casa}. Manter salão, banheiros e apoio impecáveis — a casa limpa também é hospitalidade.`,
    responsabilidades: [
      'Limpar salão, banheiros e áreas de apoio',
      'Reabastecer insumos de higiene',
      'Apoiar a organização antes e depois do movimento',
      'Seguir rotinas e produtos indicados pela casa',
    ],
    requisitos: [
      'Organização e atenção aos detalhes',
      'Disponibilidade para turnos da operação',
    ],
    diferenciais: ['Experiência em restaurante ou hotelaria'],
    horario: 'Escala 6x1 · turnos de 8h',
    salario: 'A combinar + benefícios',
  },
]

const GENERIC: RolePack = {
  match: () => true,
  descricao: (titulo, casa) =>
    `Vaga de ${titulo} na ${casa} da Panela Velha. Buscamos alguém comprometido, com vontade de crescer no time e cuidar bem de cada cliente.`,
  responsabilidades: [
    'Executar as rotinas do cargo com padrão da casa',
    'Trabalhar em equipe com salão, cozinha e operação',
    'Cuidar da experiência do cliente e da organização do ambiente',
    'Seguir normas de higiene, segurança e pontualidade',
  ],
  requisitos: [
    'Ensino médio completo (desejável)',
    'Disponibilidade para turnos e finais de semana',
    'Boa comunicação e trabalho em equipe',
    'Comprometimento com horário e padrão de atendimento',
  ],
  diferenciais: ['Experiência no cargo ou em restaurante', 'Disponibilidade imediata'],
  horario: 'Escala 6x1 · turnos de 8h',
  salario: 'A combinar + benefícios',
}

export function generateVagaDraft(input: {
  titulo: string
  unitName?: string
  tipo?: string
  regime?: string
}): VagaAiDraft {
  const titulo = input.titulo.trim() || 'profissional'
  const titleKey = titulo.toLowerCase()
  const casa = casaLabel(input.unitName)
  const pack = ROLES.find((role) => role.match(titleKey)) || GENERIC
  const tipo = input.tipo?.trim() || 'Presencial'
  const regime = input.regime?.trim() || 'CLT'

  const requisitos = [...pack.requisitos]
  if (tipo === 'Presencial' && !requisitos.some((r) => /presencial|unidade|casa/i.test(r))) {
    requisitos.push('Trabalho presencial na unidade')
  }
  if (regime === 'CLT' && !requisitos.some((r) => /clt/i.test(r))) {
    requisitos.push('Disponibilidade para contratação CLT')
  }

  return {
    descricao: pack.descricao(titulo, casa),
    localidade: input.unitName?.trim() ? `${input.unitName.trim()} · Presencial` : 'Presencial',
    horario: pack.horario,
    salario: pack.salario,
    responsabilidades: bullets(pack.responsabilidades),
    requisitos: bullets(requisitos),
    diferenciais: bullets(pack.diferenciais),
    beneficios: bullets(BENEFICIOS_CASA),
  }
}
