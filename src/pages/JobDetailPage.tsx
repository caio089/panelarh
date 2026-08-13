import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Building2,
  Clock3,
  Wallet,
  BriefcaseBusiness,
  ListChecks,
  Sparkles,
  Gift,
  ClipboardList,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { PublicHeader, PublicFooter, EmptyState } from '@/components/Layout'
import { Alert, Button } from '@/components/ui'
import { linesFromText } from '@/lib/vagaDetails'

export function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isStaff } = useAuth()
  const { getVaga } = useData()
  const [error, setError] = useState('')

  const vaga = id ? getVaga(id) : undefined

  function handleApply() {
    setError('')
    if (isStaff) {
      setError('Contas de RH não se candidatam por aqui.')
      return
    }
    if (!vaga) return
    navigate(`/vagas/${vaga.id}/candidatar`)
  }

  if (!vaga) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-16">
          <EmptyState
            tone="dark"
            title="Vaga não encontrada"
            description="Ela pode ter sido encerrada ou o link está incorreto."
            action={
              <Link to="/">
                <Button>Ver vagas abertas</Button>
              </Link>
            }
          />
        </div>
        <PublicFooter />
      </div>
    )
  }

  const responsabilidades = linesFromText(vaga.responsabilidades)
  const requisitos = linesFromText(vaga.requisitos)
  const diferenciais = linesFromText(vaga.diferenciais)
  const beneficios = linesFromText(vaga.beneficios)

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <div className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-[var(--pv-cream)] transition hover:bg-white/15"
        >
          <ArrowLeft size={16} /> Voltar às vagas
        </Link>

        <article className="pv-card animate-fade-up mt-6 overflow-hidden">
          <div className="border-b border-[var(--pv-line)] bg-gradient-to-br from-[#FBF9F3] to-[#F3EEE0] px-6 py-7 sm:px-9">
            <p className="pv-eyebrow">Oportunidade</p>
            <h1 className="mt-2 font-display text-3xl text-[var(--pv-navy)] sm:text-4xl">{vaga.titulo}</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--pv-muted)]">
              {vaga.descricao}
            </p>

            <div className="mt-5 flex flex-wrap gap-2 text-sm text-[var(--pv-muted)]">
              <MetaChip icon={<Building2 size={14} />} label={vaga.unitName || 'Unidade'} />
              <MetaChip icon={<MapPin size={14} />} label={vaga.localidade || 'Presencial'} />
              <MetaChip icon={<BriefcaseBusiness size={14} />} label={vaga.tipo || 'Presencial'} />
              {vaga.regime ? <MetaChip icon={<ClipboardList size={14} />} label={vaga.regime} /> : null}
            </div>
          </div>

          <div className="grid gap-3 border-b border-[var(--pv-line)] bg-white px-6 py-5 sm:grid-cols-3 sm:px-9">
            <Highlight
              icon={<Wallet size={18} />}
              label="Remuneração"
              value={vaga.salario || 'A combinar na entrevista'}
            />
            <Highlight
              icon={<Clock3 size={18} />}
              label="Horário / escala"
              value={vaga.horario || 'A definir com a unidade'}
            />
            <Highlight
              icon={<BriefcaseBusiness size={18} />}
              label="Modelo"
              value={`${vaga.regime || 'CLT'} · ${vaga.tipo || 'Presencial'}`}
            />
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-9">
            <Section
              icon={<ClipboardList size={16} />}
              title="O que você vai fazer"
              empty="As responsabilidades serão detalhadas na entrevista."
              items={responsabilidades}
            />
            <Section
              icon={<ListChecks size={16} />}
              title="O que a vaga pede"
              empty="Requisitos serão combinados com o time de RH."
              items={requisitos}
            />
            <Section
              icon={<Sparkles size={16} />}
              title="Diferenciais"
              empty="Experiência na área é um plus."
              items={diferenciais}
            />
            <Section
              icon={<Gift size={16} />}
              title="Benefícios"
              empty="Benefícios serão confirmados na proposta."
              items={beneficios}
            />

            <div className="rounded-2xl border border-[var(--pv-line)] bg-[#F7F4EC] p-5">
              <p className="text-[12px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
                Processo seletivo
              </p>
              <ol className="mt-3 grid gap-2 text-sm text-[var(--pv-navy)] sm:grid-cols-4">
                {[
                  '1. Formulário da vaga',
                  '2. Análise do RH',
                  '3. Entrevista',
                  '4. Proposta / início',
                ].map((step) => (
                  <li
                    key={step}
                    className="rounded-xl bg-white px-3 py-3 font-semibold ring-1 ring-[var(--pv-line)]"
                  >
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-3 border-t border-[var(--pv-line)] pt-6">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={handleApply}>
                  Candidatar-se agora
                </Button>
                <p className="max-w-sm text-sm text-[var(--pv-muted)]">
                  Sem criar conta: responda as perguntas e o RH recebe tudo ligado a esta vaga.
                </p>
              </div>
              {error ? <Alert tone="error">{error}</Alert> : null}
            </div>
          </div>
        </article>
      </div>
      <PublicFooter />
    </div>
  )
}

function MetaChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 ring-1 ring-[var(--pv-line)]">
      {icon}
      {label}
    </span>
  )
}

function Highlight({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-[#FBF9F3] px-4 py-3 ring-1 ring-[var(--pv-line)]">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--pv-muted)]">
        <span className="text-[var(--pv-terracotta)]">{icon}</span>
        {label}
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-snug text-[var(--pv-navy)]">{value}</p>
    </div>
  )
}

function Section({
  icon,
  title,
  items,
  empty,
}: {
  icon: ReactNode
  title: string
  items: string[]
  empty: string
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[1px] text-[var(--pv-navy)]">
        <span className="text-[var(--pv-terracotta)]">{icon}</span>
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--pv-muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5 text-[15px] leading-relaxed text-[#3F3B2F]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-sm bg-[var(--pv-terracotta)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
