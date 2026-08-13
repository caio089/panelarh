import { Link } from 'react-router-dom'
import { MapPin, ArrowRight, Clock3, Wallet } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { PublicHeader, PublicFooter, EmptyState } from '@/components/Layout'
import { Button } from '@/components/ui'

export function CareersPage() {
  const { store } = useData()
  const vagas = store.vagas.filter((v) => v.ativa)

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[var(--pv-terracotta)]/15 blur-3xl" />
          <div className="absolute right-0 top-0 h-[420px] w-[55%] bg-[radial-gradient(ellipse_at_top_right,rgba(239,227,196,0.12),transparent_60%)]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-14 pt-16 sm:pt-20">
          <div className="animate-fade-up max-w-3xl">
            <img
              src="/logo-panela-velha.png"
              alt="Panela Velha"
              className="mb-6 h-16 w-auto object-contain drop-shadow-md sm:h-[72px]"
            />
            <p className="pv-eyebrow">Carreiras</p>
            <h1 className="mt-3 font-display text-[2.5rem] leading-[1.08] text-[#F7F4EC] sm:text-5xl lg:text-[58px]">
              Venha fazer parte
              <br />
              da nossa cozinha.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--pv-cream)]/80">
              Vagas abertas nas unidades Panela Velha. Candidate-se, complete seu perfil e acompanhe
              cada etapa do processo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#vagas">
                <Button size="lg">
                  Ver vagas abertas <ArrowRight size={16} />
                </Button>
              </a>
              <Link to="/auth">
                <Button variant="outline" size="lg">
                  Área do candidato
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="vagas" className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-[#F7F4EC] sm:text-3xl">Vagas abertas</h2>
            <p className="mt-1 text-sm pv-cream-text">
              {vagas.length === 0
                ? 'Nenhuma oportunidade no momento'
                : `${vagas.length} oportunidade${vagas.length === 1 ? '' : 's'} no momento`}
            </p>
          </div>
        </div>

        {vagas.length === 0 ? (
          <EmptyState
            tone="dark"
            title="Nenhuma vaga aberta agora"
            description="Estamos preparando novas oportunidades. Volte em breve ou deixe seu perfil pronto."
            action={
              <Link to="/auth">
                <Button>Criar meu perfil</Button>
              </Link>
            }
          />
        ) : (
          <div className="pv-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vagas.map((vaga) => {
              const unit = store.units.find((u) => u.id === vaga.unit_id)
              return (
                <Link
                  key={vaga.id}
                  to={`/vagas/${vaga.id}`}
                  className="pv-card pv-card-interactive group block p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-terracotta)]"
                >
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
                    {unit?.name || 'Unidade'}
                  </p>
                  <h3 className="mt-2 font-display text-xl text-[var(--pv-navy)] transition group-hover:text-[var(--pv-terracotta)]">
                    {vaga.titulo}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--pv-muted)]">
                    {vaga.descricao}
                  </p>
                  <div className="mt-4 space-y-1.5 text-[12px] text-[var(--pv-muted)]">
                    {vaga.salario ? (
                      <p className="inline-flex items-center gap-1.5 font-semibold text-[var(--pv-navy)]">
                        <Wallet size={12} className="text-[var(--pv-terracotta)]" />
                        {vaga.salario}
                      </p>
                    ) : null}
                    <p className="inline-flex items-center gap-1.5">
                      <Clock3 size={12} />
                      {vaga.horario || vaga.tipo || 'Presencial'}
                    </p>
                    <p className="inline-flex items-center gap-1.5">
                      <MapPin size={12} />
                      {vaga.localidade || 'Presencial'}
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--pv-line)] pt-4 text-[12.5px]">
                    <span className="font-semibold text-[var(--pv-muted)]">{vaga.regime || 'CLT'}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--pv-navy)]">
                      Ver detalhes <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <PublicFooter />
    </div>
  )
}
