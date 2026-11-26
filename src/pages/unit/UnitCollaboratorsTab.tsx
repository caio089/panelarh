import { useMemo, useState } from 'react'
import { RefreshCw, Search, UserMinus, Users } from 'lucide-react'
import { Avatar, SectionCard } from '@/features/gestao/components/atoms'
import { useUnitContext } from './unitContext'

type StatusFilter = 'ativo' | 'inativo' | 'todos'

/** Cadastro único do RH, filtrado pela unidade dos sócios. */
export function UnitCollaboratorsTab() {
  const { unitName, collaborators, collaboratorsLoading, collaboratorsError, reloadCollaborators } = useUnitContext()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ativo')
  const [jobFilter, setJobFilter] = useState('')
  const [query, setQuery] = useState('')
  const active = collaborators.filter((person) => person.status === 'ativo')
  const jobs = useMemo(() => [...new Set(collaborators.map((person) => person.job_title))].sort((a, b) => a.localeCompare(b)), [collaborators])
  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('pt-BR')
    return collaborators.filter((person) =>
      (statusFilter === 'todos' || person.status === statusFilter) &&
      (!jobFilter || person.job_title === jobFilter) &&
      (!search || `${person.full_name} ${person.job_title}`.toLocaleLowerCase('pt-BR').includes(search)),
    )
  }, [collaborators, statusFilter, jobFilter, query])

  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <Summary label="Ativos" value={active.length} icon={<Users size={18} />} />
      <Summary label="Inativos" value={collaborators.length - active.length} icon={<UserMinus size={18} />} />
      <article className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl"><p className="text-xs font-bold uppercase tracking-wider text-[var(--pv-muted)]">Equipe por cargo</p><div className="mt-3 flex flex-wrap gap-1.5">{jobs.map((job) => <span key={job} className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[var(--pv-ink)]">{job} · {active.filter((person) => person.job_title === job).length}</span>)}</div></article>
    </div>
    {collaboratorsError ? <div role="alert" className="rounded-xl bg-[#5A2A29] p-4 text-sm text-white">{collaboratorsError} <button type="button" onClick={() => void reloadCollaborators()} className="ml-2 font-bold underline">Tentar novamente</button></div> : null}
    <SectionCard title={`Colaboradores · ${unitName}`} subtitle="Equipe cadastrada pelo RH nesta unidade.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-[#F1EDE0] p-1" role="tablist" aria-label="Status">{(['ativo', 'inativo', 'todos'] as const).map((status) => <button key={status} type="button" role="tab" aria-selected={statusFilter === status} onClick={() => setStatusFilter(status)} className={`rounded-lg px-3 py-2 text-xs font-bold ${statusFilter === status ? 'bg-white text-[var(--pv-navy)] shadow-sm' : 'text-[var(--pv-muted)]'}`}>{status === 'ativo' ? 'Ativos' : status === 'inativo' ? 'Inativos' : 'Todos'}</button>)}</div>
        <select aria-label="Filtrar por cargo" value={jobFilter} onChange={(event) => setJobFilter(event.target.value)} className="min-h-10 rounded-xl border border-[var(--pv-line-strong)] bg-white px-3 text-xs text-[var(--pv-ink)]"><option value="">Todos os cargos</option>{jobs.map((job) => <option key={job} value={job}>{job}</option>)}</select>
        <label className="relative min-w-[190px] flex-1"><Search size={15} className="absolute left-3 top-3 text-[var(--pv-muted)]" /><input aria-label="Buscar colaborador" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome ou cargo" className="min-h-10 w-full rounded-xl border border-[var(--pv-line-strong)] bg-white pl-9 pr-3 text-xs text-[var(--pv-ink)]" /></label>
        <button type="button" aria-label="Atualizar colaboradores" onClick={() => void reloadCollaborators()} disabled={collaboratorsLoading} className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--pv-line-strong)] px-3 text-xs font-semibold text-[var(--pv-ink)] disabled:opacity-50"><RefreshCw size={14} /> Atualizar</button>
      </div>
      {collaboratorsLoading ? <p role="status" className="py-8 text-center text-sm text-[var(--pv-muted)]">Carregando a equipe do banco…</p> : visible.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{visible.map((person) => <article key={person.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-[var(--pv-line)] bg-white p-3"><Avatar name={person.full_name} size={36} /><div className="min-w-0"><p className="truncate font-bold text-[var(--pv-ink)]">{person.full_name}</p><p className="text-xs text-[var(--pv-muted)]">{person.job_title} · {person.status === 'ativo' ? 'Ativo' : 'Inativo'}</p></div></article>)}</div> : <p className="py-8 text-center text-sm text-[var(--pv-muted)]">Nenhum colaborador encontrado com estes filtros.</p>}
    </SectionCard>
  </div>
}

function Summary({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <article className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl"><span className="text-[var(--pv-terracotta)]">{icon}</span><p className="mt-3 text-xs font-bold uppercase tracking-wider text-[var(--pv-muted)]">{label}</p><p className="mt-1 font-display text-3xl text-[var(--pv-ink)]">{value}</p></article>
}
