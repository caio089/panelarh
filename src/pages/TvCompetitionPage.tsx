import { Clock3, Crown, Flame, Trophy, UtensilsCrossed } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

type UnitScore = {
  name: string
  sales: number
  orders: number
  kitchenMinutes: number
  goal: number
  accent: string
}

// Dados temporários para a apresentação. Quando as credenciais de cada unidade
// estiverem disponíveis, esta lista será preenchida pelo consolidado Saipos.
const DEMO_UNITS: UnitScore[] = [
  { name: 'Dirceu', sales: 18420, orders: 438, kitchenMinutes: 12.4, goal: 88, accent: '#F4B942' },
  { name: 'Aldeota', sales: 17180, orders: 405, kitchenMinutes: 11.8, goal: 82, accent: '#E15B3F' },
  { name: 'Parangaba', sales: 15340, orders: 371, kitchenMinutes: 13.6, goal: 74, accent: '#80C997' },
  { name: 'Benfica', sales: 13920, orders: 342, kitchenMinutes: 14.1, goal: 67, accent: '#9BA7FF' },
]

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export function TvCompetitionPage() {
  const [updatedAt, setUpdatedAt] = useState(() => new Date())
  useEffect(() => {
    const interval = window.setInterval(() => setUpdatedAt(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])
  const revenueRanking = [...DEMO_UNITS].sort((a, b) => b.sales - a.sales)
  const kitchenRanking = [...DEMO_UNITS].sort((a, b) => a.kitchenMinutes - b.kitchenMinutes)
  const leader = revenueRanking[0]

  return (
    <main className="min-h-screen overflow-hidden bg-[#071024] px-5 py-5 text-[#F9F6EC] sm:px-9 lg:px-12 lg:py-8">
      <div className="pointer-events-none fixed -left-32 top-20 h-[32rem] w-[32rem] rounded-full bg-[#3151A7]/25 blur-[140px]" />
      <div className="pointer-events-none fixed -right-24 -top-28 h-[28rem] w-[28rem] rounded-full bg-[#E15B3F]/20 blur-[130px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1800px] flex-col">
        <header className="flex items-center justify-between gap-5 border-b border-white/12 pb-5 lg:pb-7">
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="font-display text-2xl tracking-tight text-[#EFE3C4] sm:text-3xl">Panela Velha</span>
            <span className="hidden h-8 w-px bg-white/20 sm:block" />
            <p className="hidden text-sm font-bold uppercase tracking-[0.22em] text-[#EFE3C4]/80 sm:block">Liga Panela Velha</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#EFE3C4]/20 bg-white/5 px-3 py-2 text-xs font-semibold text-[#EFE3C4] sm:px-4 sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-[#6FE2A2] shadow-[0_0_12px_#6FE2A2]" />
            AO VIVO
          </div>
        </header>

        <section className="flex flex-col justify-between gap-5 py-6 lg:flex-row lg:items-end lg:py-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#E97A61] sm:text-sm">Desafio entre unidades</p>
            <h1 className="mt-2 font-display text-4xl leading-none sm:text-5xl lg:text-6xl">Quem está no topo hoje?</h1>
            <p className="mt-3 text-sm text-white/60 sm:text-base">{formatDate(updatedAt)} · Acumulado do dia</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
            <Flame className="text-[#F4B942]" size={25} />
            <p className="text-sm leading-tight text-white/70">A disputa está acesa.<br /><strong className="text-white">Cada pedido conta.</strong></p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="relative overflow-hidden rounded-[28px] border border-[#F4B942]/35 bg-gradient-to-br from-[#303060] via-[#182658] to-[#101a3a] p-5 shadow-2xl sm:p-7">
            <Crown className="absolute -right-4 -top-3 text-[#F4B942]/15" size={190} strokeWidth={1} />
            <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-[#F4B942]">Líder em vendas</p>
            <div className="relative mt-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl sm:text-5xl">{leader.name}</h2>
                <p className="mt-2 text-base text-white/65">{leader.orders} pedidos realizados</p>
              </div>
              <Trophy className="mb-1 shrink-0 text-[#F4B942]" size={52} />
            </div>
            <div className="relative mt-7 flex items-end justify-between gap-4 border-t border-white/15 pt-5">
              <p className="font-display text-3xl text-[#F4B942] sm:text-4xl">{money.format(leader.sales)}</p>
              <p className="text-right text-sm text-white/65">{leader.goal}%<br />da meta do dia</p>
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 sm:p-7">
            <div className="flex items-center gap-2 text-[#80C997]"><UtensilsCrossed size={21} /><p className="text-xs font-bold uppercase tracking-[0.18em]">Cozinha mais rápida</p></div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl sm:text-5xl">{kitchenRanking[0].name}</h2>
                <p className="mt-2 text-base text-white/65">do pedido ao pronto</p>
              </div>
              <p className="font-display text-4xl text-[#80C997] sm:text-5xl">{kitchenRanking[0].kitchenMinutes.toLocaleString('pt-BR')}<span className="text-xl"> min</span></p>
            </div>
            <div className="mt-7 border-t border-white/12 pt-4 text-sm text-white/55"><Clock3 className="mr-1.5 inline" size={15} />Menor tempo médio de preparo hoje</div>
          </article>
        </section>

        <section className="mt-5 grid min-h-0 flex-1 gap-5 lg:grid-cols-2">
          <RankingCard title="Ranking de vendas" subtitle="Faturamento acumulado" icon={<Trophy size={20} />} units={revenueRanking} type="sales" />
          <RankingCard title="Velocidade da cozinha" subtitle="Menos minutos, melhor posição" icon={<Clock3 size={20} />} units={kitchenRanking} type="kitchen" />
        </section>

        <footer className="flex items-center justify-between gap-4 pt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35 sm:text-xs">
          <span>Panela Velha · competição interna</span>
          <span className="text-right">Dados demonstrativos · integração Saipos em preparação</span>
        </footer>
      </div>
    </main>
  )
}

function RankingCard({ title, subtitle, icon, units, type }: { title: string; subtitle: string; icon: ReactNode; units: UnitScore[]; type: 'sales' | 'kitchen' }) {
  const maxSales = Math.max(...units.map((unit) => unit.sales))
  return (
    <article className="rounded-[28px] border border-white/10 bg-[#0D1731]/80 p-4 shadow-xl backdrop-blur sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div><h2 className="font-display text-xl sm:text-2xl">{title}</h2><p className="mt-1 text-xs text-white/50">{subtitle}</p></div>
        <span className="rounded-xl bg-white/8 p-2.5 text-[#EFE3C4]">{icon}</span>
      </div>
      <ol className="mt-2 divide-y divide-white/8">
        {units.map((unit, index) => {
          const value = type === 'sales' ? money.format(unit.sales) : `${unit.kitchenMinutes.toLocaleString('pt-BR')} min`
          const width = type === 'sales' ? (unit.sales / maxSales) * 100 : (units[0].kitchenMinutes / unit.kitchenMinutes) * 100
          return <li key={unit.name} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:gap-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold ${index === 0 ? 'bg-[#F4B942] text-[#18142A]' : 'bg-white/8 text-white/65'}`}>{index + 1}</span>
            <div className="min-w-0"><div className="flex justify-between gap-2"><p className="truncate text-sm font-bold sm:text-base">{unit.name}</p><span className="text-xs text-white/45">{type === 'sales' ? `${unit.orders} pedidos` : 'preparo'}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: unit.accent }} /></div></div>
            <strong className="font-display text-base text-[#F9F6EC] sm:text-lg">{value}</strong>
          </li>
        })}
      </ol>
    </article>
  )
}
