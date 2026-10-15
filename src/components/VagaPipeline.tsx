import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { STATUS_META, type CandidateStatus, type Vaga } from '@/types'

const STAGES: CandidateStatus[] = ['pendente', 'entrevista', 'aprovada', 'banco']

export function VagaPipeline({
  vaga,
  unitName,
  candidatos,
}: {
  vaga: Vaga
  unitName?: string
  candidatos: { id: string; nome: string; status: CandidateStatus }[]
}) {
  return (
    <section className="rounded-2xl bg-[#FBF9F3] p-4 shadow-xl sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--pv-terracotta)]">
            {unitName || 'Vaga'}
            {vaga.ativa === false ? ' · encerrada' : ''}
          </p>
          <h3 className="mt-1 font-display text-2xl text-[var(--pv-ink)]">{vaga.titulo}</h3>
        </div>
        <Link
          to={`/admin/vagas/${vaga.id}`}
          className="inline-flex items-center gap-1 rounded-xl bg-[var(--pv-navy)] px-3 py-2 text-sm font-bold text-[var(--pv-cream)]"
        >
          Mover no quadro <ArrowUpRight size={15} />
        </Link>
      </header>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((status) => {
          const people = candidatos.filter((candidato) => candidato.status === status)
          const meta = STATUS_META[status]
          return (
            <div key={status} className="rounded-xl px-3 py-3" style={{ background: meta.bg }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                {meta.label} · {people.length}
              </p>
              {people.length === 0 ? (
                <p className="mt-3 text-sm text-[#8A8472]">Ninguém nesta etapa</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {people.slice(0, 6).map((pessoa) => (
                    <li key={pessoa.id}>
                      <Link
                        to={`/admin/vagas/${vaga.id}`}
                        className="block rounded-lg bg-white px-2.5 py-1.5 text-sm font-semibold text-[var(--pv-ink)]"
                      >
                        {pessoa.nome}
                      </Link>
                    </li>
                  ))}
                  {people.length > 6 ? (
                    <li className="text-xs font-semibold" style={{ color: meta.color }}>
                      +{people.length - 6} nesta etapa
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
