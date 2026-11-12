import { Link, useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  ClipboardCheck,
  FileClock,
  FileText,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
} from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { cn } from '@/lib/utils'
import { loadPeopleOpsOverview, type PeopleOpsOverview } from '@/lib/peopleOpsDb'

type Area = 'visao' | 'rh' | 'dp'

const AREAS: Array<{ id: Area; label: string }> = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'rh', label: 'RH' },
  { id: 'dp', label: 'Departamento Pessoal' },
]

/**
 * Central operacional da pessoa responsável pelo RH. Ela separa as rotinas
 * de pessoas das rotinas documentais/DP e mantém a entrada por unidade.
 */
export function PeopleOpsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedArea = searchParams.get('area') as Area | null
  const area = AREAS.some((item) => item.id === requestedArea) ? requestedArea! : 'visao'
  const [overview, setOverview] = useState<PeopleOpsOverview | null>(null)

  useEffect(() => {
    void loadPeopleOpsOverview().then(setOverview)
  }, [])

  function selectArea(next: Area) {
    setSearchParams(next === 'visao' ? {} : { area: next })
  }

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <PageHeader
        eyebrow="Pessoas"
        title="Central de RH e DP"
        description="Um só lugar para cuidar das pessoas da rede, com rotinas separadas de RH e Departamento Pessoal."
      />

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-white/10" aria-label="Áreas de Pessoas">
        {AREAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectArea(item.id)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition',
              area === item.id
                ? 'border-[var(--pv-terracotta)] text-white'
                : 'border-transparent text-[var(--pv-cream)]/60 hover:text-white',
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {area === 'visao' ? <Overview overview={overview} /> : null}
      {area === 'rh' ? <RhArea /> : null}
      {area === 'dp' ? <DpArea /> : null}
    </div>
  )
}

function Overview({ overview }: { overview: PeopleOpsOverview | null }) {
  return (
    <div className="mt-6 space-y-6">
      <section className="relative overflow-hidden rounded-[26px] border border-[#FFB39F]/50 bg-gradient-to-br from-[#F06B4E] via-[var(--pv-terracotta)] to-[#B83E2C] p-5 shadow-[0_18px_38px_rgba(225,91,63,0.28)] sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-[#FFD8BA]/30 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-white/75">Mesa de trabalho</p><h2 className="mt-1 font-display text-2xl text-white">Tudo que o RH precisa, sem misturar com candidatos.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85">Candidatos ficam em Recrutamento. Colaboradores têm cadastro operacional, por unidade, em uma área própria.</p></div>
          <span className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/25">RH + DP</span>
        </div>
      </section>

      {overview ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<GraduationCap size={18} />} label="Treinamentos pendentes" value={overview.treinamentos_pendentes} hint="Dados reais do RH" />
          <Metric icon={<FileText size={18} />} label="Documentos pendentes" value={overview.documentos_pendentes} hint="Dados reais do DP" />
          <Metric icon={<HeartPulse size={18} />} label="Atestados em aberto" value={overview.atestados_abertos} hint="Acompanhamento ativo" />
          <Metric icon={<FileClock size={18} />} label="SID em acompanhamento" value={overview.sid_abertos} hint="Histórico funcional" />
        </section>
      ) : (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--pv-cream)]/75">Entre novamente na conta de RH para carregar os indicadores protegidos de DP.</p>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <AreaCard
          eyebrow="Cadastro operacional"
          title="Colaboradores da rede"
          description="Cadastre as pessoas já contratadas por unidade e registre o histórico funcional de cada uma."
          to="/admin/colaboradores"
          items={['Cadastro por unidade e cargo', 'Ocorrências, SID e documentos', 'Histórico individual consultável']}
          icon={<HeartHandshake size={23} />}
        />
        <AreaCard
          eyebrow="RH"
          title="Atrair, desenvolver e cuidar do time"
          description="Vagas, recrutamento, treinamentos e capacitações da rede."
          to="?area=rh"
          items={['Vagas e pipeline de seleção', 'Treinamentos e capacitações', 'Banco de talentos separado']}
          icon={<GraduationCap size={23} />}
        />
        <AreaCard
          eyebrow="Departamento Pessoal"
          title="Manter a vida funcional organizada"
          description="Atestados, registros SID, holerites, exames e documentos de cada colaborador."
          to="?area=dp"
          items={['Atestados e afastamentos', 'SID e histórico funcional', 'Holerites, ASO e exames']}
          icon={<ClipboardCheck size={23} />}
          accent="navy"
        />
      </section>

      <section className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[1.3px] text-[var(--pv-muted)]">Como a operação fica organizada</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <FlowStep number="1" title="Candidatos" text="Entram por vagas, pipeline e seleção. Não são colaboradores." />
          <FlowStep number="2" title="RH" text="Conduz recrutamento, treinamento e capacitação." />
          <FlowStep number="3" title="DP" text="Controla documentos e ocorrências do colaborador já cadastrado." />
        </div>
      </section>
    </div>
  )
}

function RhArea() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <ModuleCard
        icon={<BriefcaseBusiness size={20} />}
        label="Recrutamento e seleção"
        title="Vagas da rede"
        description="Abra vagas por unidade, acompanhe candidatos e use a seleção assistida para priorizar perfis."
        links={[
          { to: '/admin/vagas', label: 'Gerenciar vagas' },
          { to: '/admin/quadro', label: 'Ver pipeline' },
          { to: '/admin/selecao', label: 'Abrir seleção' },
        ]}
      />
      <ModuleCard
        icon={<GraduationCap size={20} />}
        label="Desenvolvimento"
        title="Treinamentos e capacitação"
        description="Esta é a base para organizar trilhas por função e unidade: integração, segurança alimentar, atendimento, cozinha e liderança."
        links={[]}
        note="O cadastro operacional de colaboradores será uma etapa separada. Assim, candidatos e colaboradores não se misturam."
      />
    </div>
  )
}

function DpArea() {
  return (
    <div className="mt-6">
      <ModuleCard
        icon={<ClipboardCheck size={20} />}
        label="Departamento pessoal"
        title="Falta, atestado, advertência e documento"
        description="Abra a pessoa e registre falta, atestado, advertência ou documento na ficha."
        links={[{ to: '/admin/colaboradores', label: 'Abrir colaboradores' }]}
      />
    </div>
  )
}


function Metric({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string | number; hint: string }) {
  return (
    <article className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl">
      <div className="flex items-center gap-2 text-[var(--pv-terracotta)]">{icon}<span className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-muted)]">{label}</span></div>
      <p className="mt-3 font-display text-3xl text-[var(--pv-ink)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--pv-muted)]">{hint}</p>
    </article>
  )
}

function AreaCard({ eyebrow, title, description, to, items, icon, accent = 'terracotta' }: { eyebrow: string; title: string; description: string; to: string; items: string[]; icon: ReactNode; accent?: 'terracotta' | 'navy' }) {
  const navy = accent === 'navy'
  return (
    <Link to={to} className={cn('group rounded-2xl p-5 shadow-xl transition hover:-translate-y-0.5 sm:p-6', navy ? 'bg-[#172448] text-[#F7F4EC]' : 'bg-[var(--pv-surface)]')}>
      <div className="flex items-start justify-between gap-4"><div><p className={cn('text-[11px] font-bold uppercase tracking-[1.4px]', navy ? 'text-[var(--pv-cream)]/60' : 'text-[var(--pv-terracotta)]')}>{eyebrow}</p><h2 className={cn('mt-1 font-display text-2xl', navy ? 'text-white' : 'text-[var(--pv-ink)]')}>{title}</h2></div><span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', navy ? 'bg-white/10 text-[var(--pv-cream)]' : 'bg-[#F8E8E3] text-[var(--pv-terracotta)]')}>{icon}</span></div>
      <p className={cn('mt-3 text-sm leading-relaxed', navy ? 'text-[var(--pv-cream)]/75' : 'text-[var(--pv-muted)]')}>{description}</p>
      <ul className="mt-4 space-y-2">{items.map((item) => <li key={item} className={cn('flex items-center gap-2 text-xs font-semibold', navy ? 'text-[var(--pv-cream)]/90' : 'text-[var(--pv-ink)]')}><BadgeCheck size={14} className={navy ? 'text-[var(--pv-cream)]' : 'text-[var(--pv-success)]'} />{item}</li>)}</ul>
      <span className={cn('mt-5 inline-flex items-center gap-1 text-sm font-bold', navy ? 'text-white' : 'text-[var(--pv-terracotta)]')}>Abrir área <ArrowRight size={15} className="transition group-hover:translate-x-0.5" /></span>
    </Link>
  )
}

function ModuleCard({ icon, label, title, description, links, note }: { icon: ReactNode; label: string; title: string; description: string; links: Array<{ to: string; label: string }>; note?: string }) {
  return (
    <section className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl sm:p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8E8E3] text-[var(--pv-terracotta)]">{icon}</div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[1.3px] text-[var(--pv-muted)]">{label}</p>
      <h2 className="mt-1 font-display text-2xl text-[var(--pv-ink)]">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--pv-muted)]">{description}</p>
      <div className="mt-5 flex flex-wrap gap-2">{links.map((link) => <Link key={link.to + link.label} to={link.to} className="inline-flex items-center gap-1.5 rounded-lg bg-[#F1EDE0] px-3 py-2 text-xs font-bold text-[var(--pv-navy)] transition hover:bg-[#E7E2D3]">{link.label} <ArrowRight size={13} /></Link>)}</div>
      {note ? <p className="mt-4 rounded-xl bg-[#F7F4EC] px-3 py-2.5 text-xs leading-relaxed text-[var(--pv-muted)]">{note}</p> : null}
    </section>
  )
}

function FlowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-xl bg-[#F7F4EC] p-4"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--pv-navy)] text-xs font-bold text-white">{number}</span><h3 className="mt-3 text-sm font-bold text-[var(--pv-ink)]">{title}</h3><p className="mt-1 text-xs leading-relaxed text-[var(--pv-muted)]">{text}</p></div>
}
