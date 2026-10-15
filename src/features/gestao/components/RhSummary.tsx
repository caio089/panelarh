import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useData } from '@/contexts/DataContext'
import { countByStatus } from '@/lib/data'
import { OCCURRENCE_META, OCCURRENCE_TYPES } from '../constants'
import type { GestaoView } from '../useGestao'

/** Números do RH na visão geral. O detalhe continua nos módulos próprios. */
export function RhSummary({ view }: { view: GestaoView }) {
  const { store } = useData()
  const counts = countByStatus(store.candidatos)
  const openJobs = store.vagas.filter((vaga) => vaga.ativa).length
  return (
    <section className="rounded-[28px] bg-[var(--pv-surface)] p-5 shadow-xl sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--pv-terracotta)]">RH</p>
          <h2 className="mt-1 font-display text-2xl text-[var(--pv-ink)]">Resumo dos últimos 30 dias</h2>
        </div>
        <Link
          to="/admin/rh"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--pv-terracotta)] hover:underline"
        >
          Abrir o RH <ArrowUpRight size={15} />
        </Link>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OCCURRENCE_TYPES.map((type) => (
          <div key={type} className="rounded-2xl px-3 py-3" style={{ background: OCCURRENCE_META[type].bg }}>
            <p className="font-display text-2xl leading-none" style={{ color: OCCURRENCE_META[type].color }}>
              {view.occurrences[type]}
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase text-[var(--pv-muted)]">{OCCURRENCE_META[type].plural}</p>
          </div>
        ))}
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <Fact label="Vagas abertas" value={openJobs} to="/admin/vagas" />
        <Fact label="Candidatos" value={store.candidatos.length} to="/admin/candidatos" hint={`${counts.pendente} a chamar`} />
      </dl>
    </section>
  )
}

function Fact({ label, value, to, hint }: { label: string; value: number; to: string; hint?: string }) {
  return (
    <Link to={to} className="rounded-2xl border border-[var(--pv-line)] bg-white px-4 py-3 transition hover:border-[var(--pv-terracotta)]/40">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--pv-muted)]">{label}</dt>
      <dd className="mt-1 font-display text-2xl leading-none text-[var(--pv-ink)]">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-[var(--pv-muted)]">{hint}</p> : null}
    </Link>
  )
}
