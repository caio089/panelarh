import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { RhSummary } from '@/features/gestao/components/RhSummary'
import { useGestao } from '@/features/gestao/useGestao'
import { DirceuOverview } from '@/features/dirceu/DirceuOverview'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Painel dos sócios: o dia da casa e um resumo dos outros módulos. */
export function OwnerDashboardPage() {
  const view = useGestao('30d')
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <div className="animate-fade-up">
        <PageHeader
          eyebrow="Painel dos sócios"
          title={`${greeting()}, Matheus e Andressa`}
          description={`O dia da casa e o resumo da rede · ${today}.`}
        />
      </div>

      <div className="pv-stagger mt-7 space-y-5">
        <Link
          to="/admin/selecao"
          className="flex items-center justify-between gap-4 rounded-[28px] bg-[#0A1228] px-5 py-4 text-[#F7F4EC] shadow-xl transition hover:-translate-y-0.5 sm:px-6"
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--pv-cream)]/70">IA</p>
            <p className="mt-1 font-display text-2xl">Seleção dos candidatos</p>
            <p className="mt-1 text-sm text-white/70">O match lê a vaga e aponta quem chega mais perto.</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <Sparkles size={20} />
          </span>
        </Link>
        <DirceuOverview />
        <RhSummary view={view} />

        <section>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--pv-cream)]/55">Unidades</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {view.units.map((unit) => (
              <Link
                key={unit.unitId}
                to={`/admin/unidade/${unit.unitId}`}
                className="rounded-2xl bg-[var(--pv-surface)] px-4 py-4 shadow-lg transition hover:-translate-y-0.5"
              >
                <p className="font-display text-xl text-[var(--pv-ink)]">{unit.unitName}</p>
                <p className="mt-1 text-xs text-[var(--pv-muted)]">{unit.headcount} colaboradores</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
