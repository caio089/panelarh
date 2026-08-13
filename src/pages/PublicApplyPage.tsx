import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { DISC_QUESTIONS, computeDiscScores, DISC_LABELS, type DiscDimension } from '@/lib/disc'
import { FORM_SHIFTS, YES_NO } from '@/lib/applicationForm'
import { PublicHeader, PublicFooter } from '@/components/Layout'
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'

const STEPS = ['Dados', 'Disponibilidade', 'Sobre você', 'DISC'] as const

export function PublicApplyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isStaff } = useAuth()
  const { getVaga, submitPublicApplication, store } = useData()

  const vaga = id ? getVaga(id) : undefined
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const [personal, setPersonal] = useState({
    full_name: '',
    cpf: '',
    phone: '',
    city: '',
  })
  const [job, setJob] = useState({
    preferred_unit: '',
    weekend_availability: '',
    has_transport: '',
  })
  const [shifts, setShifts] = useState<string[]>([])
  const [story, setStory] = useState({
    about_me: '',
    relevant_experience: '',
    why_company: '',
  })
  const [discAnswers, setDiscAnswers] = useState<Record<string, number>>({})

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step])
  const discScores = useMemo(() => computeDiscScores(discAnswers), [discAnswers])

  if (!vaga || !vaga.ativa) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <div className="mx-auto w-full max-w-xl flex-1 px-5 py-16 text-center">
          <p className="font-display text-2xl text-[#F7F4EC]">Vaga indisponível</p>
          <p className="mt-2 text-sm text-[var(--pv-cream)]/75">
            Ela pode ter sido encerrada ou o link está incorreto.
          </p>
          <Link to="/" className="mt-6 inline-block">
            <Button>Ver vagas abertas</Button>
          </Link>
        </div>
        <PublicFooter />
      </div>
    )
  }

  if (isStaff) return <Navigate to={`/vagas/${vaga.id}`} replace />

  function toggleShift(shift: string) {
    setShifts((prev) => (prev.includes(shift) ? prev.filter((s) => s !== shift) : [...prev, shift]))
  }

  async function nextStep() {
    setError('')
    try {
      if (step === 0) {
        if (!personal.full_name.trim() || !personal.cpf.trim() || !personal.phone.trim() || !personal.city.trim()) {
          throw new Error('Preencha nome, CPF, WhatsApp e bairro.')
        }
        if (personal.cpf.replace(/\D/g, '').length !== 11) {
          throw new Error('CPF deve ter 11 números.')
        }
      }
      if (step === 1) {
        if (!job.preferred_unit || !job.weekend_availability || !job.has_transport || shifts.length === 0) {
          throw new Error('Selecione unidade, turnos, finais de semana e transporte.')
        }
      }
      if (step === 2) {
        if (!story.about_me.trim() || !story.relevant_experience.trim() || !story.why_company.trim()) {
          throw new Error('Preencha os três campos sobre você.')
        }
      }
      if (step < STEPS.length - 1) {
        setStep((s) => s + 1)
        return
      }

      if (DISC_QUESTIONS.some((q) => discAnswers[q.key] == null)) {
        throw new Error('Responda todas as perguntas do DISC.')
      }

      if (!vaga) return
      setSaving(true)
      const result = await submitPublicApplication({
        vagaId: vaga.id,
        nome: personal.full_name.trim(),
        cpf: personal.cpf.replace(/\D/g, ''),
        phone: personal.phone.trim(),
        city: personal.city.trim(),
        preferredUnit: job.preferred_unit,
        shifts: shifts.join(', '),
        weekendAvailability: job.weekend_availability,
        hasTransport: job.has_transport,
        aboutMe: story.about_me.trim(),
        experience: story.relevant_experience.trim(),
        whyCompany: story.why_company.trim(),
        disc: discScores,
      })
      setSaving(false)
      if (result.error) {
        setError(result.error)
        return
      }
      setDone(true)
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : 'Não foi possível continuar.')
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E4F3E9] text-[#2F7D4F]">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="mt-5 font-display text-3xl text-[#F7F4EC]">Candidatura enviada</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--pv-cream)]/80">
            Suas respostas foram para o RH da Panela Velha na vaga{' '}
            <strong className="text-white">{vaga.titulo}</strong>. Se avançar, entraremos em contato pelo
            WhatsApp.
          </p>
          <Button className="mt-8" onClick={() => navigate('/')}>
            Voltar às vagas
          </Button>
        </div>
        <PublicFooter />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Link
          to={`/vagas/${vaga.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--pv-cream)]/80 hover:text-[var(--pv-cream)]"
        >
          <ArrowLeft size={16} /> Voltar à vaga
        </Link>

        <div className="mt-5 rounded-2xl border border-white/10 bg-[var(--pv-surface)] p-5 shadow-xl sm:p-7">
          <p className="pv-eyebrow">Candidatura</p>
          <h1 className="mt-1 font-display text-2xl text-[var(--pv-navy)] sm:text-3xl">{vaga.titulo}</h1>
          <p className="mt-1 text-sm text-[var(--pv-muted)]">
            {vaga.unitName || 'Panela Velha'} · responda as perguntas e envie ao RH
          </p>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#E7E2D3]">
            <div className="h-full bg-[var(--pv-terracotta)] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => i < step && setStep(i)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  i === step
                    ? 'bg-[var(--pv-navy)] text-[var(--pv-cream)]'
                    : i < step
                      ? 'bg-[#E4F3E9] text-[#2F7D4F]'
                      : 'bg-[#F1EDE0] text-[#6B664F]'
                }`}
              >
                {i < step ? <Check size={12} /> : null}
                {label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            {step === 0 ? (
              <>
                <Field label="Nome completo *">
                  <Input
                    value={personal.full_name}
                    onChange={(e) => setPersonal({ ...personal, full_name: e.target.value })}
                    autoFocus
                  />
                </Field>
                <Field label="CPF *" hint="Somente números">
                  <Input
                    inputMode="numeric"
                    maxLength={11}
                    value={personal.cpf}
                    onChange={(e) =>
                      setPersonal({ ...personal, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })
                    }
                    placeholder="00000000000"
                  />
                </Field>
                <Field label="WhatsApp para contato *">
                  <Input
                    value={personal.phone}
                    onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
                    placeholder="(86) 90000-0000"
                  />
                </Field>
                <Field label="Bairro onde mora *">
                  <Input
                    value={personal.city}
                    onChange={(e) => setPersonal({ ...personal, city: e.target.value })}
                  />
                </Field>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Field label="Unidade de preferência *">
                  <Select
                    value={job.preferred_unit}
                    onChange={(e) => setJob({ ...job, preferred_unit: e.target.value })}
                  >
                    <option value="">Selecione</option>
                    {store.units.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div>
                  <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.45px] text-[#4A4636]">
                    Turnos que consegue trabalhar *
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FORM_SHIFTS.map((shift) => {
                      const on = shifts.includes(shift)
                      return (
                        <button
                          key={shift}
                          type="button"
                          onClick={() => toggleShift(shift)}
                          className={`rounded-xl px-3.5 py-2 text-sm font-bold transition ${
                            on
                              ? 'bg-[var(--pv-terracotta)] text-white'
                              : 'bg-[#F1EDE0] text-[var(--pv-ink)] hover:bg-[#E7E2D3]'
                          }`}
                        >
                          {shift}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <Field label="Disponibilidade aos finais de semana? *">
                  <Select
                    value={job.weekend_availability}
                    onChange={(e) => setJob({ ...job, weekend_availability: e.target.value })}
                  >
                    <option value="">Selecione</option>
                    {YES_NO.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Possui transporte? *">
                  <Select
                    value={job.has_transport}
                    onChange={(e) => setJob({ ...job, has_transport: e.target.value })}
                  >
                    <option value="">Selecione</option>
                    {YES_NO.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Field label="Nos conte um pouco sobre você *">
                  <Textarea
                    rows={4}
                    value={story.about_me}
                    onChange={(e) => setStory({ ...story, about_me: e.target.value })}
                  />
                </Field>
                <Field label="Experiência profissional mais relevante *">
                  <Textarea
                    rows={4}
                    value={story.relevant_experience}
                    onChange={(e) => setStory({ ...story, relevant_experience: e.target.value })}
                  />
                </Field>
                <Field label="Por que quer trabalhar na Panela Velha? *">
                  <Textarea
                    rows={4}
                    value={story.why_company}
                    onChange={(e) => setStory({ ...story, why_company: e.target.value })}
                  />
                </Field>
              </>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <p className="text-sm text-[#6B664F]">
                  Avalie de 1 (discordo totalmente) a 5 (concordo totalmente).
                </p>
                {DISC_QUESTIONS.map((q) => (
                  <div key={q.key} className="rounded-xl border border-[var(--pv-line)] bg-white p-4">
                    <p className="text-sm font-semibold text-[var(--pv-ink)]">{q.text}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setDiscAnswers({ ...discAnswers, [q.key]: n })}
                          className={`h-10 w-10 rounded-xl text-sm font-bold transition ${
                            discAnswers[q.key] === n
                              ? 'bg-[var(--pv-terracotta)] text-white'
                              : 'bg-[#F1EDE0] text-[var(--pv-ink)] hover:bg-[#E7E2D3]'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(Object.keys(DISC_LABELS) as DiscDimension[]).map((d) => (
                    <div
                      key={d}
                      className="rounded-xl bg-[var(--pv-navy)] px-3 py-3 text-center text-[var(--pv-cream)]"
                    >
                      <div className="text-xs opacity-80">{DISC_LABELS[d]}</div>
                      <div className="font-display text-2xl">{discScores[d]}%</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-between gap-2">
            <Button
              variant="ghost"
              disabled={step === 0 || saving}
              onClick={() => {
                setError('')
                setStep((s) => Math.max(0, s - 1))
              }}
            >
              Voltar
            </Button>
            <Button onClick={() => void nextStep()} disabled={saving}>
              {saving ? 'Enviando…' : step === STEPS.length - 1 ? 'Enviar candidatura' : 'Continuar'}
            </Button>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
