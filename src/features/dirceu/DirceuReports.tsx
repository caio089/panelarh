import { useState, type ReactNode } from 'react'
import type {
  DirceuPayload,
  EntregasReport,
  FaturamentoReport,
  FinanceEntry,
  FinanceiroReport,
  ItemProduct,
  ItensReport,
  SaleOrder,
} from './types'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

export function DirceuReportView({ payload }: { payload: DirceuPayload }) {
  if (payload.category === 'faturamento') {
    return <FaturamentoView report={payload.report as FaturamentoReport} showDate={payload.period !== 'dia'} />
  }
  if (payload.category === 'itens') return <ItensView report={payload.report as ItensReport} />
  if (payload.category === 'entregas') {
    return <EntregasView report={payload.report as EntregasReport} showDate={payload.period !== 'dia'} />
  }
  return <FinanceiroView report={payload.report as FinanceiroReport} />
}

function FaturamentoView({ report, showDate }: { report: FaturamentoReport; showDate: boolean }) {
  const maxHour = Math.max(1, ...report.byHour.map((item) => item.revenue))
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Faturamento" value={money.format(report.revenue)} />
        <Metric label="Pedidos" value={String(report.count)} detail={plural(report.canceledCount, 'cancelado', 'cancelados')} />
        <Metric label="Ticket médio" value={money.format(report.averageTicket)} />
        <Metric label="Descontos" value={money.format(report.discounts)} detail={`Acréscimos ${money.format(report.increases)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Canais">
          <ShareList
            rows={report.byType.map((item) => ({
              label: item.label,
              value: money.format(item.revenue),
              share: report.revenue ? item.revenue / report.revenue : 0,
              detail: `${item.count} pedidos`,
            }))}
          />
        </Panel>
        <Panel title="Formas de pagamento">
          <ShareList
            rows={report.byPayment.map((item) => ({
              label: item.label,
              value: money.format(item.amount),
              share: report.revenue ? item.amount / report.revenue : 0,
              detail: `${item.count} ${item.count === 1 ? 'pagamento' : 'pagamentos'}`,
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Por hora">
          {report.byHour.length === 0 ? <Empty>Nenhum pedido neste dia.</Empty> : null}
          <ul className="space-y-2">
            {report.byHour.map((item) => (
              <li key={item.hour} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 text-sm">
                <span className="font-semibold tabular-nums">{item.hour}h</span>
                <span className="h-2 overflow-hidden rounded-full bg-[var(--pv-line)]">
                  <span
                    className="block h-full rounded-full bg-[#0A1228]"
                    style={{ width: `${Math.max(6, (item.revenue / maxHour) * 100)}%` }}
                  />
                </span>
                <span className="tabular-nums text-[var(--pv-ink)]/70">
                  {item.count} · {money.format(item.revenue)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="space-y-4">
          <Panel title="Turnos">
            {report.byShift.length === 0 ? <Empty>Sem turno informado.</Empty> : null}
            <ul className="space-y-2 text-sm">
              {report.byShift.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3">
                  <span>{item.label}</span>
                  <span className="tabular-nums text-[var(--pv-ink)]/70">
                    {item.count} · {money.format(item.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Taxa de entrega e cupons">
            <p className="text-sm">Taxas somadas: <strong>{money.format(report.deliveryFees)}</strong></p>
            {report.coupons.length === 0 ? <p className="mt-2 text-sm text-[var(--pv-ink)]/60">Nenhum cupom neste dia.</p> : null}
            <ul className="mt-2 space-y-1 text-sm">
              {report.coupons.map((item) => (
                <li key={item.label} className="flex justify-between gap-3">
                  <span>{item.label}</span>
                  <span className="tabular-nums">{item.count} · {money.format(item.discount)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <OrderList orders={report.orders} orderTotal={report.orderTotal} showDate={showDate} />
    </div>
  )
}

const ORDER_PAGE = 10

function OrderList({ orders, orderTotal, showDate }: { orders: SaleOrder[]; orderTotal: number; showDate: boolean }) {
  const signature = `${orders[0]?.date ?? ''}:${orders[0]?.number ?? ''}:${orders[0]?.time ?? ''}`
  const [seen, setSeen] = useState(signature)
  const [visible, setVisible] = useState(ORDER_PAGE)
  if (seen !== signature) {
    setSeen(signature)
    setVisible(ORDER_PAGE)
  }

  const shown = orders.slice(0, visible)
  const remaining = orders.length - shown.length
  const next = Math.min(ORDER_PAGE, remaining)
  const title = orders.length === 0 ? 'Pedidos' : `Pedidos · ${shown.length} de ${orders.length}`

  return (
    <Panel title={title}>
      {orders.length === 0 ? <Empty>Nenhum pedido neste período.</Empty> : null}
      {orders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--pv-ink)]/50">
              <tr>
                {showDate ? <th className="pb-2 pr-3 font-semibold">Dia</th> : null}
                <th className="pb-2 pr-3 font-semibold">Hora</th>
                <th className="pb-2 pr-3 font-semibold">Pedido</th>
                <th className="pb-2 pr-3 font-semibold">Canal</th>
                <th className="pb-2 pr-3 font-semibold">Pagamento</th>
                <th className="pb-2 pr-3 font-semibold">Detalhe</th>
                <th className="pb-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((order, index) => (
                <tr key={`${order.number}-${order.time}-${index}`} className="border-t border-[var(--pv-line)]">
                  {showDate ? <td className="py-2 pr-3 tabular-nums">{order.date ? `${order.date.slice(8, 10)}/${order.date.slice(5, 7)}` : '—'}</td> : null}
                  <td className="py-2 pr-3 tabular-nums">{order.time || '—'}</td>
                  <td className="py-2 pr-3">{order.number || '—'}</td>
                  <td className="py-2 pr-3">{order.channel}</td>
                  <td className="py-2 pr-3">{order.payment}</td>
                  <td className="py-2 pr-3 text-[var(--pv-ink)]/70">
                    {[
                      order.canceled ? 'Cancelado' : '',
                      order.shift,
                      order.partner,
                      order.coupon ? `Cupom ${order.coupon}` : '',
                      order.discount ? `Desc. ${money.format(order.discount)}` : '',
                      order.discountReason,
                      order.deliveryFee ? `Entrega ${money.format(order.deliveryFee)}` : '',
                      order.nfce ? `NFC-e ${order.nfce}` : '',
                    ].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{money.format(order.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {orderTotal > orders.length ? (
        <p className="mt-3 text-xs text-[var(--pv-ink)]/60">A lista mostra os primeiros {orders.length} de {orderTotal} pedidos. Os totais acima usam o período inteiro.</p>
      ) : null}
      {next > 0 ? (
        <button
          type="button"
          onClick={() => setVisible((current) => current + next)}
          className="mt-4 w-full rounded-xl border border-[var(--pv-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--pv-ink)] transition hover:border-[#0A1228]/30"
        >
          Carregar mais {next}
        </button>
      ) : null}
    </Panel>
  )
}

function ItensView({ report }: { report: ItensReport }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Itens lançados" value={quantity.format(report.quantity)} />
        <Metric label="Produtos diferentes" value={String(report.productCount)} />
        <Metric label="Valor dos itens" value={money.format(report.revenue)} />
        <Metric label="Itens excluídos" value={String(report.deletedCount)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <ProductRanking products={report.products} productCount={report.productCount} />
        <Panel title="Complementos">
          {report.extras.length === 0 ? <Empty>Nenhum complemento neste dia.</Empty> : null}
          <ul className="space-y-2 text-sm">
            {report.extras.map((item) => (
              <li key={item.name} className="flex justify-between gap-3">
                <span>{item.name}</span>
                <span className="tabular-nums">{quantity.format(item.quantity)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function ProductRanking({ products, productCount }: { products: ItemProduct[]; productCount: number }) {
  const signature = products[0]?.name ?? ''
  const [seen, setSeen] = useState(signature)
  const [visible, setVisible] = useState(ORDER_PAGE)
  if (seen !== signature) {
    setSeen(signature)
    setVisible(ORDER_PAGE)
  }

  const shown = products.slice(0, visible)
  const next = Math.min(ORDER_PAGE, products.length - shown.length)
  const title = products.length === 0 ? 'Ranking' : `Ranking · ${shown.length} de ${products.length}`

  return (
    <Panel title={title}>
      {products.length === 0 ? <Empty>A Saipos não devolveu itens neste período.</Empty> : null}
      {products.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--pv-ink)]/50">
              <tr>
                <th className="pb-2 pr-3 font-semibold">#</th>
                <th className="pb-2 pr-3 font-semibold">Item</th>
                <th className="pb-2 pr-3 text-right font-semibold">Qtd</th>
                <th className="pb-2 pr-3 text-right font-semibold">Pedidos</th>
                <th className="pb-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item, index) => (
                <tr key={item.name} className="border-t border-[var(--pv-line)]">
                  <td className="py-2 pr-3 tabular-nums text-[var(--pv-ink)]/50">{index + 1}</td>
                  <td className="py-2 pr-3">{item.name}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{quantity.format(item.quantity)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{item.orders}</td>
                  <td className="py-2 text-right tabular-nums">{money.format(item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {productCount > products.length ? (
        <p className="mt-3 text-xs text-[var(--pv-ink)]/60">
          A lista mostra os primeiros {products.length} de {productCount} produtos. Os totais acima usam o período inteiro.
        </p>
      ) : null}
      {next > 0 ? (
        <button
          type="button"
          onClick={() => setVisible((current) => current + next)}
          className="mt-4 w-full rounded-xl border border-[var(--pv-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--pv-ink)] transition hover:border-[#0A1228]/30"
        >
          Carregar mais {next}
        </button>
      ) : null}
    </Panel>
  )
}

function EntregasView({ report, showDate }: { report: EntregasReport; showDate: boolean }) {
  const maxHour = Math.max(1, ...report.byHour.map((item) => item.revenue))
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Entregas"
          value={String(report.count)}
          detail={report.canceledCount === 0 ? 'Nenhuma cancelada' : plural(report.canceledCount, 'cancelada', 'canceladas')}
        />
        <Metric label="Faturamento" value={money.format(report.revenue)} />
        <Metric label="Taxas" value={money.format(report.fees)} detail={report.count ? `Média ${money.format(report.averageFee)}` : undefined} />
        <Metric label="Ticket médio" value={money.format(report.averageTicket)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Por hora">
          {report.byHour.length === 0 ? <Empty>Nenhuma entrega neste período.</Empty> : null}
          <ul className="space-y-2">
            {report.byHour.map((item) => (
              <li key={item.hour} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 text-sm">
                <span className="font-semibold tabular-nums">{item.hour}h</span>
                <span className="h-2 overflow-hidden rounded-full bg-[var(--pv-line)]">
                  <span className="block h-full rounded-full bg-[#0A1228]" style={{ width: `${Math.max(6, (item.revenue / maxHour) * 100)}%` }} />
                </span>
                <span className="tabular-nums text-[var(--pv-ink)]/70">{item.count} · {money.format(item.revenue)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Motoboys">
          <ShareList
            rows={(report.byRider ?? []).map((item) => ({
              label: item.label,
              value: money.format(item.fees),
              share: report.fees ? item.fees / report.fees : 0,
              detail: `${item.count} ${item.count === 1 ? 'entrega' : 'entregas'}`,
            }))}
          />
        </Panel>
        <Panel title="Parceiros">
          <ShareList
            rows={report.byPartner.map((item) => ({
              label: item.label,
              value: money.format(item.revenue),
              share: report.revenue ? item.revenue / report.revenue : 0,
              detail: `${item.count} entregas · taxas ${money.format(item.fees)}`,
            }))}
          />
        </Panel>
      </div>
      <DeliveryList orders={report.orders} orderTotal={report.orderTotal} showDate={showDate} />
    </div>
  )
}

function DeliveryList({ orders, orderTotal, showDate }: { orders: SaleOrder[]; orderTotal: number; showDate: boolean }) {
  const signature = `${orders[0]?.date ?? ''}:${orders[0]?.number ?? ''}:${orders[0]?.time ?? ''}`
  const [seen, setSeen] = useState(signature)
  const [visible, setVisible] = useState(ORDER_PAGE)
  if (seen !== signature) {
    setSeen(signature)
    setVisible(ORDER_PAGE)
  }
  const shown = orders.slice(0, visible)
  const remaining = orders.length - shown.length
  const next = Math.min(ORDER_PAGE, remaining)

  return (
    <Panel title={orders.length === 0 ? 'Pedidos de entrega' : `Pedidos de entrega · ${shown.length} de ${orders.length}`}>
      {orders.length === 0 ? <Empty>Nenhuma entrega neste período.</Empty> : null}
      {orders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--pv-ink)]/50">
              <tr>
                {showDate ? <th className="pb-2 pr-3 font-semibold">Dia</th> : null}
                <th className="pb-2 pr-3 font-semibold">Hora</th>
                <th className="pb-2 pr-3 font-semibold">Pedido</th>
                <th className="pb-2 pr-3 font-semibold">Motoboy</th>
                <th className="pb-2 pr-3 font-semibold">Parceiro</th>
                <th className="pb-2 pr-3 font-semibold">Pagamento</th>
                <th className="pb-2 pr-3 text-right font-semibold">Taxa</th>
                <th className="pb-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((order, index) => (
                <tr key={`${order.number}-${order.time}-${index}`} className="border-t border-[var(--pv-line)]">
                  {showDate ? <td className="py-2 pr-3 tabular-nums">{order.date ? `${order.date.slice(8, 10)}/${order.date.slice(5, 7)}` : '—'}</td> : null}
                  <td className="py-2 pr-3 tabular-nums">{order.time || '—'}</td>
                  <td className="py-2 pr-3">{order.number || '—'}</td>
                  <td className="py-2 pr-3">{order.rider || 'Sem motoboy'}</td>
                  <td className="py-2 pr-3">{order.canceled ? 'Cancelada · ' : ''}{order.partner || 'Entrega própria'}</td>
                  <td className="py-2 pr-3">{order.payment}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{money.format(order.deliveryFee)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{money.format(order.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {orderTotal > orders.length ? (
        <p className="mt-3 text-xs text-[var(--pv-ink)]/60">A lista mostra as primeiras {orders.length} de {orderTotal} entregas. Os totais acima usam o período inteiro.</p>
      ) : null}
      {next > 0 ? (
        <button
          type="button"
          onClick={() => setVisible((current) => current + next)}
          className="mt-4 w-full rounded-xl border border-[var(--pv-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--pv-ink)] transition hover:border-[#0A1228]/30"
        >
          Carregar mais {next}
        </button>
      ) : null}
    </Panel>
  )
}


function FinanceiroView({ report }: { report: FinanceiroReport }) {
  if (report.count === 0) {
    return <Empty>Nenhum lançamento financeiro neste período.</Empty>
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Lançado no dia" value={money.format(report.due)} detail={`${report.count} lançamentos`} />
        <Metric label="Pago" value={money.format(report.paid)} />
        <Metric
          label="Em aberto"
          value={money.format(report.openAmount)}
          detail={report.openCount === 0 ? 'Nenhuma conta em aberto' : `${report.openCount} ${report.openCount === 1 ? 'conta' : 'contas'}`}
        />
        <Metric label="Categorias" value={String(report.byCategory.length)} />
      </div>
      <Panel title="Por categoria">
        <ShareList
          rows={report.byCategory.map((item) => ({
            label: item.label,
            value: money.format(item.amount),
            share: report.due ? item.amount / report.due : 0,
            detail: `${item.count} lançamentos`,
          }))}
        />
      </Panel>
      <FinanceEntries entries={report.entries} total={report.count} />
    </div>
  )
}

function FinanceEntries({ entries, total }: { entries: FinanceEntry[]; total: number }) {
  const signature = `${entries[0]?.description ?? ''}:${entries[0]?.amount ?? ''}`
  const [seen, setSeen] = useState(signature)
  const [visible, setVisible] = useState(ORDER_PAGE)
  if (seen !== signature) {
    setSeen(signature)
    setVisible(ORDER_PAGE)
  }

  const shown = entries.slice(0, visible)
  const next = Math.min(ORDER_PAGE, entries.length - shown.length)
  const title = entries.length === 0 ? 'Lançamentos' : `Lançamentos · ${shown.length} de ${entries.length}`

  return (
    <Panel title={title}>
      {entries.length === 0 ? <Empty>Nenhum lançamento financeiro neste período.</Empty> : null}
      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--pv-ink)]/50">
              <tr>
                <th className="pb-2 pr-3 font-semibold">Descrição</th>
                <th className="pb-2 pr-3 font-semibold">Categoria</th>
                <th className="pb-2 pr-3 font-semibold">Fornecedor</th>
                <th className="pb-2 pr-3 font-semibold">Situação</th>
                <th className="pb-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((entry, index) => (
                <tr key={`${entry.description}-${index}`} className="border-t border-[var(--pv-line)]">
                  <td className="py-2 pr-3">
                    {entry.description}
                    {entry.note ? <span className="block text-xs text-[var(--pv-ink)]/55">{entry.note}</span> : null}
                  </td>
                  <td className="py-2 pr-3">{entry.category}</td>
                  <td className="py-2 pr-3">{entry.provider || '—'}</td>
                  <td className="py-2 pr-3">
                    {entry.paid ? 'Pago' : 'Em aberto'}
                    {entry.recurring ? ' · recorrente' : ''}
                    {entry.totalInstallments > 1 ? ` · ${entry.installment}/${entry.totalInstallments}` : ''}
                    {entry.paymentMethod ? ` · ${entry.paymentMethod}` : ''}
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums">{money.format(entry.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {total > entries.length ? (
        <p className="mt-3 text-xs text-[var(--pv-ink)]/60">
          A lista mostra os primeiros {entries.length} de {total} lançamentos. Os totais acima usam o período inteiro.
        </p>
      ) : null}
      {next > 0 ? (
        <button
          type="button"
          onClick={() => setVisible((current) => current + next)}
          className="mt-4 w-full rounded-xl border border-[var(--pv-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--pv-ink)] transition hover:border-[#0A1228]/30"
        >
          Carregar mais {next}
        </button>
      ) : null}
    </Panel>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--pv-line)] bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[var(--pv-ink)]/50">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
      {detail ? <p className="mt-1 text-xs text-[var(--pv-ink)]/60">{detail}</p> : null}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--pv-line)] bg-white px-4 py-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function ShareList({ rows }: { rows: { label: string; value: string; share: number; detail: string }[] }) {
  if (rows.length === 0) return <Empty>Nada neste agrupamento.</Empty>
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{row.label}</span>
            <span className="tabular-nums">{row.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--pv-line)]">
            <div className="h-full rounded-full bg-[var(--pv-terracotta)]" style={{ width: `${Math.max(4, row.share * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-[var(--pv-ink)]/55">{row.detail}</p>
        </li>
      ))}
    </ul>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--pv-ink)]/65">{children}</p>
}

function plural(count: number, one: string, many: string) {
  if (count === 0) return `Nenhum ${one}`
  return `${count} ${count === 1 ? one : many}`
}
