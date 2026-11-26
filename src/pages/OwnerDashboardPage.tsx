import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, BriefcaseBusiness, CalendarClock, ClipboardList, FileClock, FileText, HeartPulse, RefreshCw, ShieldAlert, Sparkles, Users, UserRoundCheck } from 'lucide-react'
import { CompetitionAdminPanel } from '@/features/dirceu/CompetitionAdminPanel'
import { useAuth } from '@/contexts/AuthContext'
import { type AdminOverview, loadAdminOverview } from '@/lib/adminOverviewDb'

const periods = [7, 30, 90] as const
type Period = (typeof periods)[number]
const number = (value: number) => value.toLocaleString('pt-BR')
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Fortaleza', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
}

function Metric({ label, value, detail, icon, tone = 'cream' }: {
  label: string; value: string | number; detail: string; icon: React.ReactNode; tone?: 'cream' | 'peach' | 'blue' | 'mint'
}) {
  const colors = {
    cream: 'bg-[#FFF3CD] text-[#332611]', peach: 'bg-[#F9D7C7] text-[#4E241A]',
    blue: 'bg-[#DCEBFC] text-[#172D52]', mint: 'bg-[#DDF4E8] text-[#153D31]',
  }
  return <article className={`min-w-0 rounded-[24px] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.12)] sm:p-6 ${colors[tone]}`}>
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-bold">{label}</p><span aria-hidden="true">{icon}</span></div>
    <p className="mt-4 font-display text-4xl font-bold tabular-nums sm:text-5xl">{typeof value === 'number' ? number(value) : value}</p>
    <p className="mt-2 text-xs opacity-70">{detail}</p>
  </article>
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div><p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#F4B942]">{eyebrow}</p>
    <h2 className="mt-1 font-display text-2xl text-white sm:text-3xl">{title}</h2>
    {description ? <p className="mt-1 text-sm text-white/60">{description}</p> : null}</div>
}

function SimpleCount({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="flex items-center justify-between gap-3 border-b border-white/10 py-3 last:border-0">
    <span className="flex items-center gap-2 text-sm text-white/75"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>
    <strong className="font-display text-xl tabular-nums text-white">{number(value)}</strong>
  </div>
}

export function OwnerDashboardPage() {
  const [period, setPeriod] = useState<Period>(30)
  const [refreshKey, setRefreshKey] = useState(0)
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      loadAdminOverview(period).then((data) => {
        if (active) setOverview(data)
      }).catch((cause: unknown) => {
        if (active) { setOverview(null); setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o painel.') }
      }).finally(() => { if (active) setLoading(false) })
    }, 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [period, refreshKey])

  const candidates = overview?.candidates
  const activity = overview?.activity
  const occurrences = overview?.occurrences
  const weekly = overview?.weekly_candidates ?? []
  const maxWeekly = Math.max(1, ...weekly.map((item) => item.count))
  const firstTracked = overview?.generated_at ? new Date(overview.generated_at).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }) : ''

  return <div className="min-w-0 space-y-8 px-4 py-6 sm:px-8 sm:py-8">
    <header className="relative overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_88%_12%,#354B88_0%,transparent_38%),linear-gradient(125deg,#0B1730,#17244A_65%,#25305B)] p-6 text-white shadow-2xl sm:p-8 lg:p-10">
      <div className="absolute -bottom-20 -right-12 h-56 w-56 rounded-full border-[35px] border-[#F4B942]/15" aria-hidden="true" />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#F4B942]">Visão geral · sócios</p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{greeting()}, Matheus e Andressa.</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">Recrutamento, pessoas e operação das unidades em um só lugar.</p>
          <p className="mt-4 flex items-center gap-2 text-xs text-white/55"><Activity size={14} />{firstTracked ? `RH atualizado em ${firstTracked}` : 'Consultando dados do RH'}</p>
        </div>
        <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold transition hover:bg-white/20 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar</button>
      </div>
    </header>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#F4B942]">Período do RH</p><p className="mt-1 text-sm text-white/65">Candidaturas novas, atividades e ocorrências no intervalo selecionado.</p></div>
      <div className="inline-flex max-w-full rounded-full border border-white/15 bg-white/5 p-1" aria-label="Período do resumo">
        {periods.map((days) => <button key={days} type="button" aria-pressed={period === days} onClick={() => setPeriod(days)} className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${period === days ? 'bg-[#F4B942] text-[#15213D]' : 'text-white/70 hover:text-white'}`}>{days} dias</button>)}
      </div>
    </div>

    {error ? <div role="alert" className="rounded-2xl border border-[#F5B49D] bg-[#5A2A29] p-5 text-sm text-white"><p>{error}</p><div className="mt-3 flex flex-wrap gap-3"><button className="font-bold underline" onClick={() => setRefreshKey((value) => value + 1)}>Tentar novamente</button><button className="font-bold underline" onClick={() => void signOut().then(() => navigate('/admin/login', { replace: true }))}>Entrar novamente</button></div></div> : null}
    {loading && !overview ? <div role="status" className="rounded-2xl bg-white/10 p-8 text-sm text-white/70">Carregando o panorama da rede…</div> : null}

    {overview ? <>
      <section aria-label="Indicadores principais" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Candidaturas novas" value={candidates?.new ?? 0} detail={`${number(candidates?.total ?? 0)} cadastradas no total`} icon={<Users size={22} />} tone="cream" />
        <Metric label="Em entrevista" value={candidates?.interviews ?? 0} detail="Etapa atual do funil" icon={<UserRoundCheck size={22} />} tone="peach" />
        <Metric label="Vagas abertas" value={overview.active_vacancies} detail="Em todas as unidades" icon={<BriefcaseBusiness size={22} />} tone="blue" />
        <Metric label="Colaboradores ativos" value={overview.units.reduce((sum, unit) => sum + unit.headcount, 0)} detail="Equipe cadastrada na rede" icon={<HeartPulse size={22} />} tone="mint" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <section className="min-w-0 rounded-[28px] bg-[#16274B] p-5 shadow-xl sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><SectionTitle eyebrow="Recrutamento" title="Funil de candidatos" description="Situação atual de todas as candidaturas." /><Link className="inline-flex items-center gap-1 text-sm font-semibold text-[#F4B942] hover:underline" to="/admin/candidatos">Abrir candidaturas <ArrowRight size={15} /></Link></div>
          <div className="mt-5 grid gap-x-8 sm:grid-cols-2"><div>
            <SimpleCount label="Aguardando análise" value={candidates?.pending ?? 0} color="bg-[#F4B942]" />
            <SimpleCount label="Em entrevista" value={candidates?.interviews ?? 0} color="bg-[#FF9A77]" />
            <SimpleCount label="Aprovados" value={candidates?.approved ?? 0} color="bg-[#8DD9A9]" />
          </div><div>
            <SimpleCount label="Banco de talentos" value={candidates?.talent_pool ?? 0} color="bg-[#9FBFF8]" />
            <SimpleCount label="Reprovados" value={candidates?.rejected ?? 0} color="bg-[#9AACC9]" />
            <SimpleCount label="Pendentes há mais de 7 dias" value={candidates?.pending_over_7_days ?? 0} color="bg-[#F27B74]" />
          </div></div>
        </section>
        <section className="min-w-0 rounded-[28px] bg-[#203C43] p-5 shadow-xl sm:p-7">
          <SectionTitle eyebrow="Entrada no funil" title="Candidaturas por semana" description="Novos cadastros no período escolhido." />
          <div className="mt-7 flex h-36 items-end gap-2 sm:gap-3" role="img" aria-label={weekly.map((item) => `${dateLabel(item.week_start)}: ${item.count}`).join(', ')}>
            {weekly.map((item) => <div key={item.week_start} className="flex min-w-0 flex-1 flex-col items-center gap-2"><span className="text-xs font-bold text-white">{item.count}</span><div className="w-full rounded-t-lg bg-[#74D3B2]" style={{ height: `${Math.max(5, item.count / maxWeekly * 100)}px` }} /><span className="truncate text-[10px] text-white/65">{dateLabel(item.week_start)}</span></div>)}
          </div>
        </section>
      </div>

      <section className="rounded-[28px] bg-[#F9F1E4] p-5 text-[#2E2C2A] shadow-xl sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#A84E39]">Acompanhamento do RH</p><h2 className="mt-1 font-display text-2xl sm:text-3xl">Trabalho em andamento</h2><p className="mt-1 max-w-2xl text-sm text-[#6B645A]">Movimentações registradas no sistema. Elas mostram o andamento do processo, sem identificar quem fez cada ação.</p></div><Link to="/admin/quadro" className="inline-flex items-center gap-1 text-sm font-bold text-[#A84E39] hover:underline">Ver vagas <ArrowRight size={15} /></Link></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Mudanças de etapa', value: activity?.status_changes ?? 0, icon: <Activity size={18} /> },
            { label: 'Entrevistas iniciadas', value: activity?.interviews_started ?? 0, icon: <CalendarClock size={18} /> },
            { label: 'Decisões registradas', value: activity?.decisions ?? 0, icon: <UserRoundCheck size={18} /> },
            { label: 'Ocorrências lançadas', value: activity?.occurrences_recorded ?? 0, icon: <ClipboardList size={18} /> },
            { label: 'Documentos cadastrados', value: activity?.documents_registered ?? 0, icon: <FileText size={18} /> },
            { label: 'Relatórios de ponto', value: activity?.time_reports_imported ?? 0, icon: <FileClock size={18} /> },
          ].map((item) => <article key={item.label} className="rounded-2xl bg-white p-4"><div className="flex items-center gap-2 text-xs font-semibold text-[#796C5E]">{item.icon}{item.label}</div><p className="mt-3 font-display text-3xl font-bold tabular-nums">{number(item.value)}</p></article>)}
        </div>
        <p className="mt-4 text-xs text-[#796C5E]">Mudanças de etapa passam a ser contadas a partir da ativação deste painel; registros anteriores não têm histórico de movimentação.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-[28px] bg-[#492D45] p-5 text-white shadow-xl sm:p-7"><SectionTitle eyebrow="Pessoas" title="Faltas e medidas" description="Ocorrências com data no período selecionado." />
          <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-white/10 p-4"><ShieldAlert size={20} className="text-[#FFC4A8]" /><p className="mt-3 font-display text-4xl">{number(occurrences?.absences ?? 0)}</p><p className="text-sm text-white/70">Faltas</p></div><div className="rounded-2xl bg-white/10 p-4"><ClipboardList size={20} className="text-[#FFC4A8]" /><p className="mt-3 font-display text-4xl">{number(occurrences?.warnings ?? 0)}</p><p className="text-sm text-white/70">Advertências</p></div></div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70"><span>{number(occurrences?.medical_notes ?? 0)} atestados</span><span>{number(occurrences?.suspensions ?? 0)} suspensões</span></div><Link to="/admin/colaboradores" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#FFD8B1] hover:underline">Abrir colaboradores <ArrowRight size={15} /></Link>
        </section>
        <section className="rounded-[28px] bg-[#1C3554] p-5 shadow-xl sm:p-7"><SectionTitle eyebrow="Rede" title="RH por unidade" description="Equipe e recrutamento em cada casa." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{overview.units.map((unit) => <article key={unit.id} className="min-w-0 rounded-2xl bg-white/10 p-4 text-white"><h3 className="truncate font-display text-xl">{unit.name}</h3><div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span><strong className="block text-lg">{number(unit.headcount)}</strong><span className="text-white/60">pessoas</span></span><span><strong className="block text-lg">{number(unit.active_vacancies)}</strong><span className="text-white/60">vagas</span></span><span><strong className="block text-lg">{number(unit.new_candidates)}</strong><span className="text-white/60">novos candidatos</span></span><span><strong className="block text-lg">{number(unit.interviews)}</strong><span className="text-white/60">em entrevista</span></span></div><p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/65">{unit.absences} faltas · {unit.warnings} advertências</p></article>)}</div>
        </section>
      </div>
    </> : null}

    <CompetitionAdminPanel />
    <Link to="/admin/selecao" className="flex items-center justify-between gap-4 rounded-[24px] bg-[#D95B3D] p-5 text-white shadow-xl transition hover:-translate-y-0.5 sm:p-6"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-white/75">Seleção guiada</p><p className="mt-1 font-display text-2xl">Analisar candidatos com IA</p><p className="mt-1 text-sm text-white/80">Compare os perfis com os requisitos de cada vaga.</p></div><Sparkles size={24} className="shrink-0" /></Link>
  </div>
}
