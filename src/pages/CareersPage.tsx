import { Link } from 'react-router-dom'
import { MapPin, ArrowRight, Sparkles } from 'lucide-react'
import { useData } from '@/contexts/DataContext'
import { PublicHeader, EmptyState } from '@/components/Layout'
import { Button } from '@/components/ui'

export function CareersPage() {
  const { store } = useData()
  const vagas = store.vagas.filter((v) => v.ativa)

  return (
    <div className="min-h-screen">
      <PublicHeader />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_40%,rgba(225,91,63,0.22),transparent_45%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="animate-fade-up">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[2px] text-[var(--pv-terracotta)]">
              Carreiras · Panela Velha
            </p>
            <h1 className="font-display text-4xl leading-[1.1] text-[#F7F4EC] sm:text-5xl lg:text-[56px]">
              Venha fazer parte
              <br />
              da nossa cozinha.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--pv-cream)]/80">
              Vagas abertas em nossas unidades. Candidate-se, complete seu perfil e acompanhe
              cada etapa do processo seletivo.
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

          <div
            className="animate-fade-up relative hidden min-h-[280px] overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#24356E] to-[#121D40] p-8 lg:block"
            style={{ animationDelay: '80ms' }}
          >
            <Sparkles className="text-[var(--pv-cream)]" size={22} />
            <p className="mt-6 font-display text-2xl text-[#F7F4EC]">Processo transparente</p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--pv-cream)]/75">
              Perfil profissional, experiências, avaliação DISC e acompanhamento por etapa.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3 text-center">
              {['Perfil', 'DISC', 'Kanban'].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl bg-white/5 px-2 py-4 text-[12px] font-bold uppercase tracking-wide text-[var(--pv-cream)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="vagas" className="mx-auto max-w-6xl px-5 pb-24">
        <div className="mb-6">
          <h2 className="font-display text-2xl text-[#F7F4EC]">Vagas abertas</h2>
          <p className="mt-1 text-sm text-[var(--pv-cream)]/70">
            {vagas.length} oportunidade{vagas.length === 1 ? '' : 's'} no momento
          </p>
        </div>

        {vagas.length === 0 ? (
          <EmptyState title="Nenhuma vaga aberta agora" description="Volte em breve." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vagas.map((vaga, idx) => {
              const unit = store.units.find((u) => u.id === vaga.unit_id)
              return (
                <Link
                  key={vaga.id}
                  to={`/vagas/${vaga.id}`}
                  className="pv-card group animate-fade-up block p-5 transition hover:-translate-y-1 hover:shadow-xl"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
                    {unit?.name || 'Unidade'}
                  </p>
                  <h3 className="mt-2 font-display text-xl text-[var(--pv-navy)] group-hover:text-[var(--pv-terracotta)]">
                    {vaga.titulo}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-[#6B664F]">{vaga.descricao}</p>
                  <div className="mt-4 flex items-center justify-between text-[12.5px] text-[#6B664F]">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} />
                      {vaga.localidade || vaga.tipo || 'Presencial'}
                    </span>
                    <span className="font-semibold text-[var(--pv-navy)]">Candidatar-se →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
