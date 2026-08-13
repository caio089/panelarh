import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { supabase } from '@/lib/supabase'
import { DISC_QUESTIONS, computeDiscScores, DISC_LABELS, type DiscDimension } from '@/lib/disc'
import { FORM_SHIFTS, YES_NO } from '@/lib/applicationForm'
import { PublicHeader, PublicFooter, LoadingScreen } from '@/components/Layout'
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'

const STEPS = ['Dados', 'Vaga', 'Sobre você', 'DISC'] as const

export function ProfileOnboardingPage() {
  const { user, profile, loading, updateLocalProfile, refreshProfile } = useAuth()
  const { upsertProfile, store } = useData()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') || '/candidato'
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const [personal, setPersonal] = useState({
    full_name: '',
    cpf: '',
    phone: '',
    city: '',
  })
  const [job, setJob] = useState({
    desired_role: '',
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

  useEffect(() => {
    if (!user) return
    if (profile) {
      setPersonal({
        full_name: profile.full_name || '',
        cpf: profile.cpf || '',
        phone: profile.phone || '',
        city: profile.city || '',
      })
      setJob({
        desired_role: profile.desired_role || '',
        preferred_unit: profile.preferred_unit || '',
        weekend_availability: profile.weekend_availability || '',
        has_transport: profile.has_transport || '',
      })
      setShifts(
        (profile.shifts || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
      setStory({
        about_me: profile.about_me || '',
        relevant_experience: profile.relevant_experience || '',
        why_company: profile.why_company || '',
      })
    }

    void (async () => {
      const { data: answers } = await supabase
        .from('disc_answers')
        .select('question_key, value')
        .eq('profile_id', user.id)
      if (answers?.length) {
        const map: Record<string, number> = {}
        answers.forEach((a) => {
          map[a.question_key] = a.value
        })
        setDiscAnswers(map)
      }
    })()
  }, [user, profile])

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step])
  const discScores = useMemo(() => computeDiscScores(discAnswers), [discAnswers])

  if (loading) return <LoadingScreen />
  if (!user) {
    navigate(`/auth?redirect=/perfil`)
    return null
  }

  function toggleShift(shift: string) {
    setShifts((prev) => (prev.includes(shift) ? prev.filter((s) => s !== shift) : [...prev, shift]))
  }

  async function saveStep() {
    if (!user) return
    setSaving(true)
    setError('')
    setOk('')

    try {
      if (step === 0) {
        if (!personal.full_name.trim() || !personal.cpf.trim() || !personal.phone.trim() || !personal.city.trim()) {
          throw new Error('Preencha nome, CPF, WhatsApp e bairro.')
        }
        const cpf = personal.cpf.replace(/\D/g, '')
        if (cpf.length !== 11) throw new Error('CPF deve ter 11 números.')
        const { error: err } = await supabase
          .from('profiles')
          .update({
            full_name: personal.full_name.trim(),
            cpf,
            phone: personal.phone.trim(),
            city: personal.city.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
        if (err) throw err
        updateLocalProfile({
          full_name: personal.full_name.trim(),
          cpf,
          phone: personal.phone.trim(),
          city: personal.city.trim(),
        })
      }

      if (step === 1) {
        if (!job.desired_role.trim()) throw new Error('Informe o cargo de interesse.')
        if (!job.preferred_unit) throw new Error('Selecione a unidade.')
        if (shifts.length === 0) throw new Error('Selecione pelo menos um turno.')
        if (!job.weekend_availability) throw new Error('Informe a disponibilidade nos finais de semana.')
        if (!job.has_transport) throw new Error('Informe se possui transporte.')
        const shiftsText = shifts.join(', ')
        const { error: err } = await supabase
          .from('profiles')
          .update({
            desired_role: job.desired_role.trim(),
            preferred_unit: job.preferred_unit,
            weekend_availability: job.weekend_availability,
            has_transport: job.has_transport,
            shifts: shiftsText,
            availability: `${shiftsText} · FDS: ${job.weekend_availability}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
        if (err) throw err
        updateLocalProfile({
          desired_role: job.desired_role.trim(),
          preferred_unit: job.preferred_unit,
          weekend_availability: job.weekend_availability,
          has_transport: job.has_transport,
          shifts: shiftsText,
          availability: `${shiftsText} · FDS: ${job.weekend_availability}`,
        })
      }

      if (step === 2) {
        if (!story.about_me.trim() || !story.relevant_experience.trim() || !story.why_company.trim()) {
          throw new Error('Conte sobre você, a experiência e por que quer trabalhar aqui.')
        }
        const { error: err } = await supabase
          .from('profiles')
          .update({
            about_me: story.about_me.trim(),
            relevant_experience: story.relevant_experience.trim(),
            why_company: story.why_company.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
        if (err) throw err
        updateLocalProfile({
          about_me: story.about_me.trim(),
          relevant_experience: story.relevant_experience.trim(),
          why_company: story.why_company.trim(),
        })
      }

      if (step === 3) {
        const missing = DISC_QUESTIONS.some((q) => !discAnswers[q.key])
        if (missing) throw new Error('Responda todas as perguntas DISC.')
        await supabase.from('disc_answers').delete().eq('profile_id', user.id)
        const rows = DISC_QUESTIONS.map((q) => ({
          profile_id: user.id,
          question_key: q.key,
          value: discAnswers[q.key],
        }))
        const { error: err } = await supabase.from('disc_answers').insert(rows)
        if (err) throw err
        const scores = computeDiscScores(discAnswers)
        const { error: pErr } = await supabase
          .from('profiles')
          .update({
            disc_d: scores.D,
            disc_i: scores.I,
            disc_s: scores.S,
            disc_c: scores.C,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
        if (pErr) throw pErr
        updateLocalProfile({
          disc_d: scores.D,
          disc_i: scores.I,
          disc_s: scores.S,
          disc_c: scores.C,
          onboarding_completed: true,
        })
        if (profile) {
          upsertProfile({
            ...profile,
            ...personal,
            ...job,
            ...story,
            shifts: shifts.join(', '),
            onboarding_completed: true,
            id: user.id,
            role: 'candidate',
          })
        }
        await refreshProfile()
        setOk('Cadastro concluído!')
        setTimeout(() => navigate(redirect), 700)
        setSaving(false)
        return
      }

      setOk('Salvo!')
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <div className="animate-fade-up rounded-2xl border border-white/10 bg-[var(--pv-surface)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="pv-eyebrow">Vem trabalhar com a gente!</p>
              <h1 className="mt-1 font-display text-2xl text-[var(--pv-ink)] sm:text-3xl">
                Complete seu cadastro
              </h1>
              <p className="mt-2 text-sm text-[var(--pv-muted)]">
                Buscamos pessoas comprometidas, apaixonadas pelo que fazem e com vontade de crescer
                junto com a gente. Etapa {step + 1} de {STEPS.length}: {STEPS[step]}.
              </p>
            </div>
            <div className="rounded-xl bg-[#F1EDE0] px-3 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--pv-muted)]">Progresso</p>
              <p className="font-display text-lg text-[var(--pv-ink)]">{Math.round(progress)}%</p>
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#E7E2D3]">
            <div
              className="h-full rounded-full bg-[var(--pv-terracotta)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(i)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold transition ${
                  i === step
                    ? 'bg-[var(--pv-navy)] text-[var(--pv-cream)]'
                    : i < step
                      ? 'bg-[#E4F3E9] text-[#2F7D4F] hover:brightness-95'
                      : 'bg-[#F1EDE0] text-[#6B664F] hover:bg-[#E7E2D3]'
                }`}
              >
                {i < step ? <Check size={12} /> : <span className="opacity-60">{i + 1}.</span>}
                {label}
              </button>
            ))}
          </div>

          <div className="mt-7 space-y-4">
            {step === 0 && (
              <>
                <Field label="E-mail">
                  <Input value={user.email || ''} disabled />
                </Field>
                <Field label="Nos diga seu nome completo *">
                  <Input
                    value={personal.full_name}
                    onChange={(e) => setPersonal({ ...personal, full_name: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Qual o seu CPF? *" hint="Digite somente números">
                  <Input
                    inputMode="numeric"
                    maxLength={14}
                    value={personal.cpf}
                    onChange={(e) =>
                      setPersonal({ ...personal, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })
                    }
                    placeholder="00000000000"
                  />
                </Field>
                <Field label="Qual seu WhatsApp para contato? *">
                  <Input
                    value={personal.phone}
                    onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </Field>
                <Field label="Qual bairro você mora? *">
                  <Input
                    value={personal.city}
                    onChange={(e) => setPersonal({ ...personal, city: e.target.value })}
                  />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                <Field label="Qual cargo você tem interesse em trabalhar? *">
                  <Input
                    value={job.desired_role}
                    onChange={(e) => setJob({ ...job, desired_role: e.target.value })}
                    placeholder="Ex: Operador de caixa, Atendente, Cozinha"
                  />
                </Field>
                <Field label="Qual unidade você gostaria de trabalhar? *">
                  <Select
                    value={job.preferred_unit}
                    onChange={(e) => setJob({ ...job, preferred_unit: e.target.value })}
                    disabled={store.units.length === 0}
                  >
                    <option value="">
                      {store.units.length === 0 ? 'Nenhuma unidade cadastrada' : 'Selecione'}
                    </option>
                    {store.units.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div>
                  <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.45px] text-[#4A4636]">
                    Selecione os turnos que você consegue trabalhar *
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
                <Field label="Você tem disponibilidade para trabalhar aos finais de semana? *">
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
                <Field label="Você possui transporte? *">
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
            )}

            {step === 2 && (
              <>
                <Field label="Nos conte um pouco sobre você! *">
                  <Textarea
                    rows={4}
                    value={story.about_me}
                    onChange={(e) => setStory({ ...story, about_me: e.target.value })}
                  />
                </Field>
                <Field label="Descreva brevemente sua experiência profissional mais relevante para a área desejada *">
                  <Textarea
                    rows={4}
                    value={story.relevant_experience}
                    onChange={(e) => setStory({ ...story, relevant_experience: e.target.value })}
                  />
                </Field>
                <Field label="Por que você quer trabalhar na nossa empresa? *">
                  <Textarea
                    rows={4}
                    value={story.why_company}
                    onChange={(e) => setStory({ ...story, why_company: e.target.value })}
                  />
                </Field>
              </>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <p className="text-sm text-[#6B664F]">
                  Avalie de 1 (discordo totalmente) a 5 (concordo totalmente). Isso ajuda o RH a
                  entender seu perfil.
                </p>
                {DISC_QUESTIONS.map((q) => (
                  <div key={q.key} className="rounded-xl border border-[var(--pv-line)] bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-[var(--pv-ink)]">{q.text}</p>
                    <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={q.text}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={discAnswers[q.key] === n}
                          onClick={() => setDiscAnswers({ ...discAnswers, [q.key]: n })}
                          className={`h-10 w-10 rounded-xl text-sm font-bold transition ${
                            discAnswers[q.key] === n
                              ? 'bg-[var(--pv-terracotta)] text-white shadow-md'
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
                    <div key={d} className="rounded-xl bg-[var(--pv-navy)] px-3 py-3 text-center text-[var(--pv-cream)]">
                      <div className="text-xs opacity-80">{DISC_LABELS[d]}</div>
                      <div className="font-display text-2xl">{discScores[d]}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error ? (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          ) : null}
          {ok ? (
            <div className="mt-4">
              <Alert tone="success">{ok}</Alert>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-[var(--pv-line)] pt-5">
            <Button type="button" variant="ghost" disabled={step === 0 || saving} onClick={() => setStep((s) => s - 1)}>
              Voltar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void saveStep()}>
              {saving ? 'Salvando…' : step === STEPS.length - 1 ? 'Concluir cadastro' : 'Salvar e continuar'}
            </Button>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}
