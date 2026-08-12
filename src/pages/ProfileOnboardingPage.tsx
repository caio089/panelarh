import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { supabase } from '@/lib/supabase'
import { DISC_QUESTIONS, computeDiscScores, DISC_LABELS, type DiscDimension } from '@/lib/disc'
import { uid } from '@/lib/utils'
import type { Experience } from '@/types'
import { PublicHeader, LoadingScreen } from '@/components/Layout'
import { Button, Field, Input, Textarea } from '@/components/ui'

const STEPS = ['Pessoal', 'Profissional', 'Experiências', 'DISC', 'Currículo'] as const

function mockBagKey(userId: string) {
  return `panela_rh_mock_form_${userId}`
}

export function ProfileOnboardingPage() {
  const { user, profile, loading, mockMode, updateLocalProfile, refreshProfile } = useAuth()
  const { upsertProfile, replaceExperiences } = useData()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') || '/candidato'
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const [personal, setPersonal] = useState({
    full_name: '',
    phone: '',
    cpf: '',
    city: '',
    birth_date: '',
  })
  const [professional, setProfessional] = useState({
    desired_role: '',
    availability: '',
    salary_expectation: '',
    linkedin: '',
  })
  const [experiences, setExperiences] = useState<
    Array<Pick<Experience, 'id' | 'company' | 'role_title' | 'start_date' | 'end_date' | 'description'>>
  >([])
  const [discAnswers, setDiscAnswers] = useState<Record<string, number>>({})
  const [cvFile, setCvFile] = useState<File | null>(null)

  useEffect(() => {
    if (!user) return
    if (profile) {
      setPersonal({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        cpf: profile.cpf || '',
        city: profile.city || '',
        birth_date: profile.birth_date || '',
      })
      setProfessional({
        desired_role: profile.desired_role || '',
        availability: profile.availability || '',
        salary_expectation: profile.salary_expectation || '',
        linkedin: profile.linkedin || '',
      })
    }

    if (mockMode) {
      try {
        const raw = localStorage.getItem(mockBagKey(user.id))
        if (raw) {
          const parsed = JSON.parse(raw) as {
            experiences?: typeof experiences
            discAnswers?: Record<string, number>
          }
          if (parsed.experiences?.length) setExperiences(parsed.experiences)
          else {
            setExperiences([
              { id: uid(), company: '', role_title: '', start_date: '', end_date: '', description: '' },
            ])
          }
          if (parsed.discAnswers) setDiscAnswers(parsed.discAnswers)
        } else {
          setExperiences([
            { id: uid(), company: '', role_title: '', start_date: '', end_date: '', description: '' },
          ])
        }
      } catch {
        setExperiences([
          { id: uid(), company: '', role_title: '', start_date: '', end_date: '', description: '' },
        ])
      }
      return
    }

    ;(async () => {
      const [{ data: exps }, { data: answers }] = await Promise.all([
        supabase.from('experiences').select('*').eq('profile_id', user.id).order('created_at'),
        supabase.from('disc_answers').select('question_key, value').eq('profile_id', user.id),
      ])
      if (exps?.length) {
        setExperiences(
          exps.map((e) => ({
            id: e.id,
            company: e.company,
            role_title: e.role_title,
            start_date: e.start_date,
            end_date: e.end_date,
            description: e.description,
          })),
        )
      } else {
        setExperiences([
          { id: uid(), company: '', role_title: '', start_date: '', end_date: '', description: '' },
        ])
      }
      if (answers?.length) {
        const map: Record<string, number> = {}
        answers.forEach((a) => {
          map[a.question_key] = a.value
        })
        setDiscAnswers(map)
      }
    })()
  }, [user, profile, mockMode])

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step])
  const discScores = useMemo(() => computeDiscScores(discAnswers), [discAnswers])

  if (loading) return <LoadingScreen />
  if (!user) {
    navigate(`/auth?redirect=/perfil`)
    return null
  }

  function persistMockForm() {
    if (!user) return
    localStorage.setItem(
      mockBagKey(user.id),
      JSON.stringify({ experiences, discAnswers, cvName: cvFile?.name || null }),
    )
  }

  async function saveStep() {
    if (!user) return
    setSaving(true)
    setError('')
    setOk('')

    try {
      if (mockMode) {
        if (step === 0) {
          updateLocalProfile({
            full_name: personal.full_name,
            phone: personal.phone,
            cpf: personal.cpf,
            city: personal.city,
            birth_date: personal.birth_date || null,
          })
          if (user) {
            upsertProfile({
              ...(profile as NonNullable<typeof profile>),
              id: user.id,
              full_name: personal.full_name,
              phone: personal.phone,
              cpf: personal.cpf,
              city: personal.city,
              birth_date: personal.birth_date || null,
              role: 'candidate',
              email: profile?.email || user.email || null,
            })
          }
        }
        if (step === 1) {
          updateLocalProfile({ ...professional })
          if (user && profile) {
            upsertProfile({ ...profile, ...professional, id: user.id, role: 'candidate' })
          }
        }
        if (step === 2) {
          persistMockForm()
          if (user) {
            replaceExperiences(
              user.id,
              experiences
                .filter((e) => e.company.trim() && e.role_title.trim())
                .map((e) => ({
                  id: e.id,
                  profile_id: user.id,
                  company: e.company,
                  role_title: e.role_title,
                  start_date: e.start_date || null,
                  end_date: e.end_date || null,
                  description: e.description || null,
                })),
            )
          }
        }
        if (step === 3) {
          const missing = DISC_QUESTIONS.some((q) => !discAnswers[q.key])
          if (missing) throw new Error('Responda todas as perguntas DISC.')
          const scores = computeDiscScores(discAnswers)
          updateLocalProfile({
            disc_d: scores.D,
            disc_i: scores.I,
            disc_s: scores.S,
            disc_c: scores.C,
          })
          persistMockForm()
          if (user && profile) {
            upsertProfile({
              ...profile,
              id: user.id,
              role: 'candidate',
              disc_d: scores.D,
              disc_i: scores.I,
              disc_s: scores.S,
              disc_c: scores.C,
            })
          }
        }
        if (step === 4) {
          persistMockForm()
          updateLocalProfile({ onboarding_completed: true })
          if (user && profile) {
            upsertProfile({
              ...profile,
              id: user.id,
              role: 'candidate',
              onboarding_completed: true,
              full_name: personal.full_name || profile.full_name,
              phone: personal.phone || profile.phone,
              cpf: personal.cpf || profile.cpf,
              city: personal.city || profile.city,
              birth_date: personal.birth_date || profile.birth_date,
              ...professional,
            })
            replaceExperiences(
              user.id,
              experiences
                .filter((e) => e.company.trim() && e.role_title.trim())
                .map((e) => ({
                  id: e.id,
                  profile_id: user.id,
                  company: e.company,
                  role_title: e.role_title,
                  start_date: e.start_date || null,
                  end_date: e.end_date || null,
                  description: e.description || null,
                })),
            )
          }
          await refreshProfile()
          setOk('Perfil concluído! Agora você pode se candidatar.')
          setTimeout(() => navigate(redirect), 700)
          setSaving(false)
          return
        }
        setOk('Salvo!')
        setStep((s) => Math.min(s + 1, STEPS.length - 1))
        setSaving(false)
        return
      }

      if (step === 0) {
        const { error: err } = await supabase
          .from('profiles')
          .update({
            full_name: personal.full_name,
            phone: personal.phone,
            cpf: personal.cpf,
            city: personal.city,
            birth_date: personal.birth_date || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
        if (err) throw err
      }

      if (step === 1) {
        const { error: err } = await supabase
          .from('profiles')
          .update({ ...professional, updated_at: new Date().toISOString() })
          .eq('id', user.id)
        if (err) throw err
      }

      if (step === 2) {
        await supabase.from('experiences').delete().eq('profile_id', user.id)
        const rows = experiences
          .filter((e) => e.company.trim() && e.role_title.trim())
          .map((e) => ({
            id: e.id,
            profile_id: user.id,
            company: e.company,
            role_title: e.role_title,
            start_date: e.start_date || null,
            end_date: e.end_date || null,
            description: e.description || null,
          }))
        if (rows.length) {
          const { error: err } = await supabase.from('experiences').insert(rows)
          if (err) throw err
        }
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
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
        if (pErr) throw pErr
      }

      if (step === 4) {
        if (cvFile) {
          const safe = cvFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
          const path = `${user.id}/${Date.now()}-${safe}`
          const { error: upErr } = await supabase.storage
            .from('curriculos')
            .upload(path, cvFile, { upsert: true })
          if (upErr) throw upErr
        }

        const { error: err } = await supabase
          .from('profiles')
          .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
          .eq('id', user.id)
        if (err) throw err
        await refreshProfile()
        setOk('Perfil concluído!')
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
    <div className="min-h-screen">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="animate-fade-up rounded-[18px] bg-[#FBF9F3] p-6 shadow-2xl sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[1.4px] text-[var(--pv-terracotta)]">
            Cadastro do candidato
          </p>
          <h1 className="mt-1 font-display text-2xl text-[var(--pv-navy)] sm:text-3xl">
            Complete seu perfil
          </h1>
          <p className="mt-2 text-sm text-[#6B664F]">
            Essas informações serão usadas nas suas candidaturas e no painel do RH.
          </p>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#E7E2D3]">
            <div
              className="h-full rounded-full bg-[var(--pv-terracotta)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(i)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11.5px] font-bold ${
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

          <div className="mt-7 space-y-4">
            {step === 0 && (
              <>
                <Field label="Nome completo *">
                  <Input value={personal.full_name} onChange={(e) => setPersonal({ ...personal, full_name: e.target.value })} required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Telefone">
                    <Input value={personal.phone} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} placeholder="(00) 00000-0000" />
                  </Field>
                  <Field label="CPF">
                    <Input value={personal.cpf} onChange={(e) => setPersonal({ ...personal, cpf: e.target.value })} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Cidade">
                    <Input value={personal.city} onChange={(e) => setPersonal({ ...personal, city: e.target.value })} />
                  </Field>
                  <Field label="Data de nascimento">
                    <Input type="date" value={personal.birth_date} onChange={(e) => setPersonal({ ...personal, birth_date: e.target.value })} />
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <Field label="Cargo desejado">
                  <Input value={professional.desired_role} onChange={(e) => setProfessional({ ...professional, desired_role: e.target.value })} placeholder="Ex: Chapeiro, Garçom, Gerente" />
                </Field>
                <Field label="Disponibilidade">
                  <Input value={professional.availability} onChange={(e) => setProfessional({ ...professional, availability: e.target.value })} placeholder="Ex: Integral, noites, finais de semana" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Pretensão salarial (opcional)">
                    <Input value={professional.salary_expectation} onChange={(e) => setProfessional({ ...professional, salary_expectation: e.target.value })} />
                  </Field>
                  <Field label="LinkedIn (opcional)">
                    <Input value={professional.linkedin} onChange={(e) => setProfessional({ ...professional, linkedin: e.target.value })} />
                  </Field>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {experiences.map((exp, idx) => (
                  <div key={exp.id} className="rounded-xl border border-[#E7E2D3] bg-white p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-bold text-[var(--pv-navy)]">Experiência {idx + 1}</p>
                      {experiences.length > 1 && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#B23B3B]"
                          onClick={() => setExperiences(experiences.filter((e) => e.id !== exp.id))}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Empresa">
                        <Input value={exp.company} onChange={(e) => {
                          const next = [...experiences]
                          next[idx] = { ...exp, company: e.target.value }
                          setExperiences(next)
                        }} />
                      </Field>
                      <Field label="Cargo">
                        <Input value={exp.role_title} onChange={(e) => {
                          const next = [...experiences]
                          next[idx] = { ...exp, role_title: e.target.value }
                          setExperiences(next)
                        }} />
                      </Field>
                      <Field label="Início">
                        <Input value={exp.start_date || ''} placeholder="MM/AAAA" onChange={(e) => {
                          const next = [...experiences]
                          next[idx] = { ...exp, start_date: e.target.value }
                          setExperiences(next)
                        }} />
                      </Field>
                      <Field label="Fim">
                        <Input value={exp.end_date || ''} placeholder="MM/AAAA ou Atual" onChange={(e) => {
                          const next = [...experiences]
                          next[idx] = { ...exp, end_date: e.target.value }
                          setExperiences(next)
                        }} />
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="Descrição">
                        <Textarea value={exp.description || ''} onChange={(e) => {
                          const next = [...experiences]
                          next[idx] = { ...exp, description: e.target.value }
                          setExperiences(next)
                        }} />
                      </Field>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setExperiences([
                      ...experiences,
                      { id: uid(), company: '', role_title: '', start_date: '', end_date: '', description: '' },
                    ])
                  }
                >
                  + Adicionar experiência
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <p className="text-sm text-[#6B664F]">
                  Avalie de 1 (discordo totalmente) a 5 (concordo totalmente).
                </p>
                {DISC_QUESTIONS.map((q) => (
                  <div key={q.key} className="rounded-xl border border-[#E7E2D3] bg-white p-4">
                    <p className="text-sm font-semibold text-[var(--pv-navy)]">{q.text}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setDiscAnswers({ ...discAnswers, [q.key]: n })}
                          className={`h-10 w-10 rounded-full text-sm font-bold ${
                            discAnswers[q.key] === n
                              ? 'bg-[var(--pv-terracotta)] text-white'
                              : 'bg-[#F1EDE0] text-[var(--pv-navy)]'
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

            {step === 4 && (
              <div className="space-y-4">
                <Field label="Currículo (PDF ou Word)">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  />
                </Field>
                <p className="text-sm text-[#6B664F]">
                  Ao finalizar, seu perfil fica pronto para candidaturas. Você poderá editar depois.
                </p>
              </div>
            )}
          </div>

          {error ? <p className="mt-4 text-sm font-semibold text-[#B23B3B]">{error}</p> : null}
          {ok ? <p className="mt-4 text-sm font-semibold text-[#2F7D4F]">{ok}</p> : null}

          <div className="mt-7 flex flex-wrap justify-between gap-3">
            <Button type="button" variant="ghost" disabled={step === 0 || saving} onClick={() => setStep((s) => s - 1)}>
              Voltar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void saveStep()}>
              {saving ? 'Salvando…' : step === STEPS.length - 1 ? 'Concluir perfil' : 'Salvar e continuar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
