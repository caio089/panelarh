export type DirceuCategory = 'cozinha' | 'faturamento' | 'itens' | 'entregas' | 'financeiro'

export const DIRCEU_CATEGORIES: { id: DirceuCategory; label: string; hint: string }[] = [
  { id: 'cozinha', label: 'Cozinha', hint: 'Pedidos agora e tempo de cada etapa' },
  { id: 'faturamento', label: 'Faturamento', hint: 'Pedidos, canais e pagamentos' },
  { id: 'itens', label: 'Itens vendidos', hint: 'Produtos e complementos' },
  { id: 'entregas', label: 'Entregas', hint: 'Taxas, parceiros e pedidos' },
  { id: 'financeiro', label: 'Financeiro', hint: 'Contas do período' },
]

export function isDirceuCategory(value: string | null): value is DirceuCategory {
  return DIRCEU_CATEGORIES.some((item) => item.id === value)
}

export interface MoneyBucket {
  label: string
  count: number
  revenue: number
}

export interface SaleOrder {
  date: string
  time: string
  number: string
  channel: string
  amount: number
  discount: number
  increase: number
  payment: string
  canceled: boolean
  shift: string
  partner: string
  rider?: string
  coupon: string
  discountReason: string
  deliveryFee: number
  nfce: string
}

export interface FaturamentoReport {
  count: number
  canceledCount: number
  revenue: number
  discounts: number
  increases: number
  deliveryFees: number
  averageTicket: number
  byType: { id: number; label: string; count: number; revenue: number }[]
  byPayment: { label: string; amount: number; count: number }[]
  byShift: MoneyBucket[]
  byHour: { hour: string; count: number; revenue: number }[]
  coupons: { label: string; count: number; discount: number }[]
  orders: SaleOrder[]
  orderTotal: number
}

export interface ItemProduct {
  name: string
  quantity: number
  revenue: number
  orders: number
}

export interface ItensReport {
  productCount: number
  quantity: number
  revenue: number
  deletedCount: number
  products: ItemProduct[]
  extras: { name: string; quantity: number }[]
}

export interface EntregasReport {
  count: number
  canceledCount: number
  revenue: number
  fees: number
  averageTicket: number
  averageFee: number
  byPartner: { label: string; count: number; revenue: number; fees: number }[]
  byRider: { label: string; count: number; fees: number }[]
  byHour: { hour: string; count: number; revenue: number }[]
  orders: SaleOrder[]
  orderTotal: number
}

export interface FinanceEntry {
  description: string
  category: string
  provider: string
  amount: number
  paid: boolean
  recurring: boolean
  installment: number
  totalInstallments: number
  paymentMethod: string
  note: string
}

export interface FinanceiroReport {
  count: number
  due: number
  paid: number
  openAmount: number
  openCount: number
  byCategory: { label: string; amount: number; count: number }[]
  entries: FinanceEntry[]
}

export interface KitchenStage {
  label: string
  count: number
  averageMinutes: number | null
  medianMinutes: number | null
}

export interface KitchenStatus {
  label: string
  count: number
}

export interface CozinhaReport {
  total: number
  preparing: number
  waiting: number
  onTheWay: number
  finished: number
  canceled: number
  active: number
  urgent: number
  urgentAfterMinutes: number
  queue: {
    code: string
    status: string
    enteredAt: string | null
    waitingMinutes: number | null
    urgent: boolean
  }[]
  current: KitchenStatus[]
  stages: KitchenStage[]
}

export type DirceuReport = FaturamentoReport | ItensReport | EntregasReport | FinanceiroReport | CozinhaReport

export interface DirceuPayload {
  unit: string
  date: string
  period: 'dia' | 'semana' | 'mes'
  start: string
  end: string
  category: DirceuCategory
  partial?: boolean
  fetchedAt: string
  report: DirceuReport
}
