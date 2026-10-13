import { AlertTriangle, Sparkles, TrendingUp, Trophy, Wand2, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AiInsight, AiSummary, InsightTone } from '../insights'

const TONE_META: Record<InsightTone, { title: string; icon: LucideIcon; color: string; ring: string }> = {
  atencao: { title: 'Pontos de atenção', icon: AlertTriangle, color: '#F38C74', ring: 'rgba(225,91,63,0.35)' },
  melhorar: { title: 'Pontos a melhorar', icon: TrendingUp, color: '#F2C46D', ring: 'rgba(242,196,109,0.35)' },
  destaque: { title: 'Destaques', icon: Trophy, color: '#6FD49A', ring: 'rgba(111,212,154,0.35)' },
}

/** Bloco principal do painel: resumo em linguagem natural + insights agrupados. */
export function AiSummaryPanel({ summary }: { summary: AiSummary }) {
  const groups: Array<[InsightTone, AiInsight[]]> = [
    ['atencao', summary.atencao],
    ['melhorar', summary.melhorar],
    ['destaque', summary.destaques],
  ]

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#22336A] via-[#1A2853] to-[#121D40] p-6 shadow-2xl sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[var(--pv-terracotta)]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-[#3B6EA5]/30 blur-3xl" />

      <div className="relative flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--pv-terracotta)] to-[#F08A72] text-white shadow-lg shadow-[var(--pv-terracotta)]/30">
          <Sparkles size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--pv-cream)]/70">
              Resumo da IA
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--pv-cream)]">
              Prévia
            </span>
          </div>
          <h2 className="mt-1 font-display text-2xl text-white sm:text-[26px]">{summary.headline}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--pv-cream)]/85">{summary.paragraph}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-[var(--pv-cream)] transition hover:bg-white/10"
          title="Em breve: gerar relatório completo com IA"
        >
          <Wand2 size={14} /> Gerar relatório
        </button>
      </div>

      <div className="relative mt-6 grid gap-3 lg:grid-cols-3">
        {groups.map(([tone, items]) => (
          <InsightColumn key={tone} tone={tone} items={items} />
        ))}
      </div>
    </section>
  )
}

function InsightColumn({ tone, items }: { tone: InsightTone; items: AiInsight[] }) {
  const meta = TONE_META[tone]
  const Icon = meta.icon
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0E1730]/50 p-4 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: meta.ring, color: meta.color }}
        >
          <Icon size={15} />
        </span>
        <h3 className="text-[13px] font-bold text-white">{meta.title}</h3>
        <span className="ml-auto text-[11px] font-bold text-[var(--pv-cream)]/50">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--pv-cream)]/55">Nada relevante no período.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <InsightItem item={item} color={meta.color} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function InsightItem({ item, color }: { item: AiInsight; color: string }) {
  const content = (
    <div className="flex gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-snug text-white">{item.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--pv-cream)]/65">{item.detail}</p>
      </div>
    </div>
  )

  if (!item.unitId) return content
  return (
    <Link to={`/admin/unidade/${item.unitId}`} className="-m-1.5 block rounded-lg p-1.5 transition hover:bg-white/5">
      {content}
    </Link>
  )
}
