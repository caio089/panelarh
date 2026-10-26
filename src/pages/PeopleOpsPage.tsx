import { Link, useSearchParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  FileClock,
  FileText,
  GraduationCap,
  HeartPulse,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { useData } from '@/contexts/DataContext'
import { useGestaoStore } from '@/features/gestao/GestaoStoreContext'
import { cn } from '@/lib/utils'

type Area = 'visao' | 'rh' | 'dp' | 'cadastro'

const AREAS: Array<{ id: Area; label: string }> = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'rh', label: 'RH' },
  { id: 'dp', label: 'Departamento Pessoal' },
  { id: 'cadastro', label: 'Colaboradores' },
]

/**
 * Central operacional da pessoa responsável pelo RH. Ela separa as rotinas
 * de pessoas das rotinas documentais/DP e mantém a entrada por unidade.
 */
export function PeopleOpsPage() {
  const { store } = useData()
  const { colaboradores } = useGestaoStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedArea = searchParams.get('area') as Area | null
  const area = AREAS.some((item) => item.id === requestedArea) ? requestedArea! : 'visao'
  const activeTeam = colaboradores.filter((person) => person.status === 'ativo')

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

      {area === 'visao' ? <Overview activeTeam={activeTeam.length} unitCount={store.units.length} /> : null}
      {area === 'rh' ? <RhArea /> : null}
      {area === 'dp' ? <DpArea /> : null}
      {area === 'cadastro' ? <CollaboratorsArea /> : null}
    </div>
  )
}

function Overview({ activeTeam, unitCount }: { activeTeam: number; unitCount: number }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric icon={<UsersRound size={19} />} label="Colaboradores ativos" value={activeTeam} hint="Cadastro por unidade" />
        <Metric icon={<Building2 size={19} />} label="Unidades acompanhadas" value={unitCount} hint="Visão da rede inteira" />
        <Metric icon={<ShieldCheck size={19} />} label="Prontidão documental" value="—" hint="Será alimentada pelo DP" />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <AreaCard
          eyebrow="RH"
          title="Atrair, desenvolver e cuidar do time"
          description="Vagas, recrutamento, treinamentos e capacitações da rede."
          to="?area=rh"
          items={['Vagas e pipeline de seleção', 'Treinamentos e capacitações', 'Acompanhamento por unidade']}
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
          <FlowStep number="1" title="Unidade" text="A unidade mantém seu quadro de colaboradores atualizado." />
          <FlowStep number="2" title="RH" text="A pessoa de RH conduz vagas, seleção, treinamento e capacitação." />
          <FlowStep number="3" title="DP" text="O DP controla documentos e ocorrências funcionais com acesso restrito." />
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
        links={[{ to: '/admin/pessoas?area=cadastro', label: 'Ver colaboradores por unidade' }]}
        note="Próxima etapa: registrar presença, certificados e vencimentos diretamente na ficha de cada colaborador."
      />
    </div>
  )
}

function DpArea() {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <ModuleCard
          icon={<HeartPulse size={20} />}
          label="Saúde ocupacional"
          title="Atestados e afastamentos"
          description="Controle datas, período de afastamento, status e retorno ao trabalho por colaborador."
          links={[{ to: '/admin/pessoas?area=cadastro', label: 'Abrir cadastro de colaboradores' }]}
        />
        <ModuleCard
          icon={<FileClock size={20} />}
          label="Histórico funcional"
          title="SID e ocorrências"
          description="Registre o SID e mantenha o histórico funcional consultável pela responsável do RH."
          links={[{ to: '/admin/pessoas?area=cadastro', label: 'Consultar por unidade' }]}
        />
        <ModuleCard
          icon={<FileText size={20} />}
          label="Documentos"
          title="Holerites e exames"
          description="Central para holerites, exame admissional, periódicos, ASO, contratos e demais documentos."
          links={[{ to: '/admin/pessoas?area=cadastro', label: 'Selecionar colaborador' }]}
        />
      </div>

      <aside className="rounded-2xl border border-[#E6C9BE] bg-[#FFF8F4] p-4 text-sm text-[#704333]">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--pv-terracotta)]" />
          <p>
            <strong>Dados sensíveis:</strong> CID, laudos, atestados e exames precisam ficar em banco seguro, com acesso individual da responsável pelo RH e registro de quem consultou. Esta área já organiza o fluxo; o cadastro desses arquivos não deve ser feito no navegador.
          </p>
        </div>
      </aside>
    </div>
  )
}

function CollaboratorsArea() {
  const { store } = useData()
  const { colaboradores } = useGestaoStore()
  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.3px] text-[var(--pv-muted)]">Cadastro base</p>
            <h2 className="mt-1 font-display text-2xl text-[var(--pv-ink)]">Colaboradores por unidade</h2>
            <p className="mt-1 text-sm text-[var(--pv-muted)]">Use o cadastro da unidade como a ficha principal de cada pessoa.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {store.units.map((unit) => {
            const people = colaboradores.filter((item) => item.unitId === unit.id)
            const active = people.filter((item) => item.status === 'ativo').length
            return (
              <Link
                key={unit.id}
                to={`/admin/unidade/${unit.id}/colaboradores`}
                className="group rounded-xl border border-[var(--pv-line)] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[var(--pv-terracotta)]/45 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg text-[var(--pv-ink)]">{unit.name}</p>
                    <p className="mt-1 text-sm text-[var(--pv-muted)]">{active} ativos · {people.length} no cadastro</p>
                  </div>
                  <ArrowRight size={17} className="mt-1 text-[var(--pv-terracotta)] transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>
      <p className="px-1 text-xs text-[var(--pv-cream)]/65">
        Ao cadastrar um colaborador, informe unidade, função, data de admissão e status. A ficha será a referência para RH e DP.
      </p>
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
