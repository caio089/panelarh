import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, ClipboardList, ShieldAlert, Users, UserRoundCheck } from 'lucide-react'
import { type AdminOverview, loadAdminOverview } from '@/lib/adminOverviewDb'
import { shiftIsoDate, todayInFortaleza } from '@/features/dirceu/day'
import { usePeriodParam } from '@/features/gestao/usePeriodParam'
import { PeriodSelect, SectionCard } from '@/features/gestao/components/atoms'
import { DirceuOverview } from '@/features/dirceu/DirceuOverview'
import { useUnitContext } from './unitContext'

/** Visão da unidade com a mesma equipe e ocorrências do banco usado pelo RH. */
export function UnitOverviewTab() {
  const { unitId, unitName, collaborators, collaboratorsLoading, collaboratorsError } = useUnitContext()
  const [period, setPeriod] = usePeriodParam()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const saiposUnit = unitId === 'unit-dirceu' ? 'dirceu' : unitId === 'unit-promorar' ? 'promorar' : unitId === 'unit-mocambinho' ? 'mocambinho' : null

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      const today = todayInFortaleza()
      const from = shiftIsoDate(today, 1 - Number.parseInt(period, 10))
      loadAdminOverview(from, today).then((data) => { if (active) setOverview(data) })
        .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os indicadores.') })
        .finally(() => { if (active) setLoading(false) })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [period, unitName])

  const unit = overview?.units.find((item) => item.name.toLocaleLowerCase('pt-BR') === unitName.toLocaleLowerCase('pt-BR'))
  const active = collaborators.filter((person) => person.status === 'ativo')

  return <div className="space-y-5">
    {saiposUnit ? <DirceuOverview paramPrefix="ops" unit={saiposUnit} unitName={unitName} /> : null}
    <div className="flex justify-end"><PeriodSelect value={period} onChange={setPeriod} /></div>
    {error || collaboratorsError ? <div role="alert" className="rounded-xl bg-[#5A2A29] p-4 text-sm text-white">{error || collaboratorsError}</div> : null}
    {loading || collaboratorsLoading ? <p role="status" className="rounded-2xl bg-white/10 p-5 text-sm text-white/75">Carregando equipe e indicadores reais…</p> : null}
    {!loading && !collaboratorsLoading && unit ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Users size={19} />} label="Colaboradores ativos" value={active.length} detail="Cadastro compartilhado com o RH" />
        <Metric icon={<ShieldAlert size={19} />} label="Faltas" value={unit.absences} detail="No período selecionado" />
        <Metric icon={<ClipboardList size={19} />} label="Advertências" value={unit.warnings} detail="No período selecionado" />
        <Metric icon={<BriefcaseBusiness size={19} />} label="Vagas abertas" value={unit.active_vacancies} detail={`${unit.new_candidates} novos candidatos`} />
      </div>
      <SectionCard title="Equipe desta unidade" subtitle={`${active.length} ativos · ${collaborators.length - active.length} inativos · ${unit.interviews} candidatos em entrevista`} action={<Link to={`/admin/unidade/${unitId}/colaboradores`} className="inline-flex items-center gap-1 text-sm font-bold text-[var(--pv-terracotta)]">Ver todos <ArrowRight size={15} /></Link>}>
        {active.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{active.map((person) => <div key={person.id} className="rounded-xl border border-[var(--pv-line)] bg-white p-3"><p className="font-semibold text-[var(--pv-ink)]">{person.full_name}</p><p className="mt-0.5 text-xs text-[var(--pv-muted)]">{person.job_title}</p></div>)}</div> : <p className="py-5 text-sm text-[var(--pv-muted)]">Nenhum colaborador ativo cadastrado nesta unidade.</p>}
      </SectionCard>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75"><UserRoundCheck size={17} className="mr-2 inline text-[#F4B942]" />{unit.pending} candidatos aguardando análise · {unit.interviews} em entrevista</div>
    </> : null}
  </div>
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) {
  return <article className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl"><span className="text-[var(--pv-terracotta)]">{icon}</span><p className="mt-3 text-xs font-bold uppercase tracking-wider text-[var(--pv-muted)]">{label}</p><p className="mt-1 font-display text-3xl text-[var(--pv-ink)]">{value}</p><p className="mt-1 text-xs text-[var(--pv-muted)]">{detail}</p></article>
}
