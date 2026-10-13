import { Briefcase, ChevronRight, PhoneCall, UserCheck, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '@/contexts/DataContext'
import { countByStatus } from '@/lib/data'

/** Resumo do módulo de RH (vagas e banco de talentos) a partir dos dados já existentes do app. */
export function RhSnapshot() {
  const { store } = useData()
  const counts = countByStatus(store.candidatos)
  const openPositions = store.vagas.filter((v) => v.ativa).length

  const stages: Array<{ label: string; value: number; color: string }> = [
    { label: 'Triagem', value: counts.pendente, color: '#D08A1E' },
    { label: 'Chamados p/ entrevista', value: counts.entrevista, color: '#3B6EA5' },
    { label: 'Aprovados', value: counts.aprovada, color: '#2F7D4F' },
    { label: 'Banco de talentos', value: counts.banco, color: '#7A3E8E' },
  ]
  const maxStage = Math.max(...stages.map((s) => s.value), 1)

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <Stat icon={<Briefcase size={15} />} label="Vagas abertas" value={openPositions} to="/admin/vagas" />
        <Stat icon={<Users size={15} />} label="Candidatos" value={store.candidatos.length} to="/admin/candidatos" />
        <Stat icon={<PhoneCall size={15} />} label="A chamar" value={counts.pendente} to="/admin/quadro" />
      </div>

      <div className="mt-5 space-y-3">
        {stages.map((stage) => (
          <div key={stage.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--pv-ink)]">{stage.label}</span>
              <span className="font-bold text-[var(--pv-muted)]">{stage.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#EDE8DA]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(stage.value / maxStage) * 100}%`, background: stage.color }}
              />
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/admin/selecao"
        className="mt-5 flex items-center justify-between rounded-xl bg-[var(--pv-navy)] px-4 py-3 text-sm font-bold text-[var(--pv-cream)] transition hover:bg-[var(--pv-navy-light)]"
      >
        <span className="flex items-center gap-2">
          <UserCheck size={16} /> Abrir seleção com IA
        </span>
        <ChevronRight size={16} />
      </Link>
    </div>
  )
}

function Stat({ icon, label, value, to }: { icon: ReactNode; label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-xl border border-[var(--pv-line)] bg-white px-3 py-3 transition hover:border-[var(--pv-terracotta)]/40">
      <span className="text-[var(--pv-terracotta)]">{icon}</span>
      <p className="mt-2 font-display text-2xl leading-none text-[var(--pv-ink)]">{value}</p>
      <p className="mt-1 text-[10.5px] font-bold uppercase text-[var(--pv-muted)]">{label}</p>
    </Link>
  )
}
