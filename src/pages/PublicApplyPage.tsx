import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCircle2, Paperclip, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import {
  COMMUTE_OPTIONS,
  FORM_SHIFTS,
  FORM_STEPS,
  HOLIDAY_OPTIONS,
  RESTAURANT_OPTIONS,
  ROLE_OPTIONS,
  SOURCE_OPTIONS,
  STANDING_OPTIONS,
  START_OPTIONS,
  WEEKEND_OPTIONS,
  WORK_CARD_OPTIONS,
  clearApplyDraft,
  emptyApplyDraft,
  formatCpf,
  formatPhone,
  isValidAge,
  loadApplyDraft,
  saveApplyDraft,
} from '@/lib/applicationForm'
import { assertResumeFile, resumeFileLabel, uploadCurriculo } from '@/lib/curriculoStorage'
import { HOUSE_UNITS } from '@/lib/demo/seedData'
import { PublicHeader, PublicFooter } from '@/components/Layout'
import { Alert, Button, Field, Input, Select, Textarea } from '@/components/ui'

const LAST_STEP = FORM_STEPS.length - 1
const HOUSE_NAMES = new Set(HOUSE_UNITS.map((unit) => unit.name))

export function PublicApplyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isStaff } = useAuth()
  const { getVaga, submitPublicApplication, store, sharedReady } = useData()

  const vaga = id ? getVaga(id) : undefined
  const saved = id ? loadApplyDraft(id) : null
  const blank = emptyApplyDraft()
  const submitted = useRef(false)

  const [step, setStep] = useState(saved?.step ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [personal, setPersonal] = useState(saved?.personal ?? blank.personal)
  const [job, setJob] = useState(
    saved?.job ?? { ...blank.job, preferred_unit: vaga?.unitName && HOUSE_NAMES.has(vaga.unitName) ? vaga.unitName : '' },
  )
  const [shifts, setShifts] = useState<string[]>(saved?.shifts ?? [])
  const [experience, setExperience] = useState(saved?.experience ?? blank.experience)
  const [extra, setExtra] = useState(saved?.extra ?? blank.extra)
  const [resume, setResume] = useState<File | null>(null)

  const progress = useMemo(() => ((step + 1) / FORM_STEPS.length) * 100, [step])
  const houseUnits = store.units.filter((unit) => HOUSE_NAMES.has(unit.name))

  useEffect(() => {
    if (!id || submitted.current) return
    saveApplyDraft(id, { step, personal, job, shifts, experience, extra })
  }, [id, step, personal, job, shifts, experience, extra])

  if (!sharedReady) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <div className="mx-auto w-full max-w-xl flex-1 px-5 py-16 text-center">
          <p className="font-display text-2xl text-[#F7F4EC]">Carregando vaga…</p>
        </div>
        <PublicFooter />
      </div>
    )
  }

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
    setShifts((prev) => (prev.includes(shift) ? prev.filter((item) => item !== shift) : [...prev, shift]))
  }

  function toggleRole(role: string) {
    setExperience((prev) => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter((item) => item !== role) : [...prev.roles, role],
    }))
  }

  function pickResume(file: File | null) {
    if (!file) {
      setResume(null)
      return
    }
    try {
      assertResumeFile(file)
      setError('')
      setResume(file)
    } catch (err) {
      setResume(null)
      setError(err instanceof Error ? err.message : 'Arquivo inválido.')
    }
  }

  async function nextStep() {
    setError('')
    try {
      if (step === 0) {
        if (!personal.full_name.trim() || personal.cpf.length !== 11 || personal.phone.length < 10 || !personal.city.trim()) {
          throw new Error('Preencha nome, CPF, WhatsApp e bairro.')
        }
        if (!isValidAge(personal.age)) throw new Error('Informe uma idade entre 16 e 70 anos.')
      }
      if (step === 1) {
        if (!job.preferred_unit || !job.weekend || !job.commute || !job.holidays || shifts.length === 0) {
          throw new Error('Escolha a unidade, os turnos, o fim de semana, os feriados e como você chega.')
        }
      }
      if (step === 2) {
        if (!experience.worked || !experience.start) {
          throw new Error('Diga se já trabalhou em restaurante e quando pode começar.')
        }
        if (experience.roles.length === 0) throw new Error('Marque o que você já fez, mesmo que seja o primeiro emprego.')
        if (experience.detail.trim().length < 20 || experience.daily.trim().length < 20 || experience.why.trim().length < 20) {
          throw new Error('Escreva um pouco mais nos três textos. O RH precisa entender seu trabalho.')
        }
      }
      if (step < LAST_STEP) {
        setStep((current) => current + 1)
        return
      }

      if (!extra.workCard || !extra.source || !extra.standing) {
        throw new Error('Responda carteira de trabalho, como soube da vaga e se aguenta o turno em pé.')
      }

      if (!vaga || !id) return
      setSaving(true)
      let curriculoUrl: string | null = null
      let curriculoNome: string | null = null
      if (resume) {
        const uploaded = await uploadCurriculo(resume, vaga.id)
        curriculoUrl = uploaded.url
        curriculoNome = uploaded.nome
      }
      const result = await submitPublicApplication({
        vagaId: vaga.id,
        nome: personal.full_name.trim(),
        cpf: personal.cpf,
        phone: personal.phone,
        city: personal.city.trim(),
        age: personal.age,
        preferredUnit: job.preferred_unit,
        shifts: shifts.join(', '),
        weekendAvailability: job.weekend,
        commute: job.commute,
        holidays: job.holidays,
        workedRestaurant: experience.worked,
        roles: experience.roles.join(', '),
        experience: experience.detail.trim(),
        dailyWork: experience.daily.trim(),
        whyRole: experience.why.trim(),
        startWhen: experience.start,
        workCard: extra.workCard,
        source: extra.source,
        standing: extra.standing,
        restriction: extra.restriction.trim(),
        reference: extra.reference.trim(),
        curriculoUrl,
        curriculoNome,
      })
      setSaving(false)
      if (result.error) {
        setError(result.error)
        return
      }
      submitted.current = true
      clearApplyDraft(id)
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
            {vaga.unitName || 'Panela Velha'} · quatro passos. Se sair e voltar, as respostas continuam aqui.
          </p>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#E7E2D3]">
            <div className="h-full bg-[var(--pv-terracotta)] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {FORM_STEPS.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => index < step && setStep(index)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  index === step
                    ? 'bg-[var(--pv-navy)] text-[var(--pv-cream)]'
                    : index < step
                      ? 'bg-[#E4F3E9] text-[#2F7D4F]'
                      : 'bg-[#F1EDE0] text-[#6B664F]'
                }`}
              >
                {index < step ? <Check size={12} /> : null}
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
                    onChange={(event) => setPersonal({ ...personal, full_name: event.target.value })}
                    autoFocus
                    autoComplete="name"
                  />
                </Field>
                <Field label="WhatsApp *" hint="É por aqui que o RH chama">
                  <Input
                    inputMode="tel"
                    autoComplete="tel"
                    value={formatPhone(personal.phone)}
                    onChange={(event) =>
                      setPersonal({ ...personal, phone: event.target.value.replace(/\D/g, '').slice(0, 11) })
                    }
                    placeholder="(86) 90000-0000"
                  />
                </Field>
                <Field label="Bairro onde mora *">
                  <Input
                    value={personal.city}
                    onChange={(event) => setPersonal({ ...personal, city: event.target.value })}
                    placeholder="Ex.: Dirceu"
                  />
                </Field>
                <Field label="CPF *" hint="Só os números, para o cadastro">
                  <Input
                    inputMode="numeric"
                    value={formatCpf(personal.cpf)}
                    onChange={(event) =>
                      setPersonal({ ...personal, cpf: event.target.value.replace(/\D/g, '').slice(0, 11) })
                    }
                    placeholder="000.000.000-00"
                  />
                </Field>
                <Field label="Idade *" hint="Precisa ter pelo menos 16 anos">
                  <Input
                    inputMode="numeric"
                    value={personal.age}
                    onChange={(event) =>
                      setPersonal({ ...personal, age: event.target.value.replace(/\D/g, '').slice(0, 2) })
                    }
                    placeholder="Ex.: 24"
                  />
                </Field>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Field label="Unidade de preferência *">
                  <Select
                    value={job.preferred_unit}
                    onChange={(event) => setJob({ ...job, preferred_unit: event.target.value })}
                  >
                    <option value="">Selecione</option>
                    {houseUnits.map((unit) => (
                      <option key={unit.id} value={unit.name}>
                        {unit.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Choices
                  label="Turnos que consegue trabalhar *"
                  values={shifts}
                  options={FORM_SHIFTS}
                  onToggle={toggleShift}
                />
                <Choices
                  label="Pode trabalhar no fim de semana? *"
                  value={job.weekend}
                  options={WEEKEND_OPTIONS}
                  onChange={(weekend) => setJob({ ...job, weekend })}
                />
                <Choices
                  label="Pode trabalhar em feriados? *"
                  value={job.holidays}
                  options={HOLIDAY_OPTIONS}
                  onChange={(holidays) => setJob({ ...job, holidays })}
                />
                <Choices
                  label="Como você chega no trabalho? *"
                  value={job.commute}
                  options={COMMUTE_OPTIONS}
                  onChange={(commute) => setJob({ ...job, commute })}
                />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Choices
                  label="Já trabalhou em restaurante, lanchonete ou bar? *"
                  value={experience.worked}
                  options={RESTAURANT_OPTIONS}
                  onChange={(worked) => setExperience({ ...experience, worked })}
                />
                <Choices
                  label="O que você já fez? *"
                  values={experience.roles}
                  options={ROLE_OPTIONS}
                  onToggle={toggleRole}
                />
                <Field
                  label="Último trabalho *"
                  hint="Casa, função e por quanto tempo. Se for o primeiro, escreva isso."
                >
                  <Textarea
                    rows={3}
                    value={experience.detail}
                    onChange={(event) => setExperience({ ...experience, detail: event.target.value })}
                    placeholder="Ex.: Atendente no salão do restaurante do centro, de 2023 a 2024."
                  />
                </Field>
                <Field label="O que você fazia no dia a dia? *" hint="Duas ou três frases, com o que o RH precisa saber.">
                  <Textarea
                    rows={3}
                    value={experience.daily}
                    onChange={(event) => setExperience({ ...experience, daily: event.target.value })}
                    placeholder="Ex.: Anotava pedidos, servia mesas e fechava a conta no caixa."
                  />
                </Field>
                <Field label="Por que quer esta vaga? *">
                  <Textarea
                    rows={3}
                    value={experience.why}
                    onChange={(event) => setExperience({ ...experience, why: event.target.value })}
                    placeholder="Ex.: Quero trabalhar no atendimento da unidade do Dirceu e aprender o ritmo da casa."
                  />
                </Field>
                <Choices
                  label="Quando pode começar? *"
                  value={experience.start}
                  options={START_OPTIONS}
                  onChange={(start) => setExperience({ ...experience, start })}
                />
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Choices
                  label="Tem carteira de trabalho? *"
                  value={extra.workCard}
                  options={WORK_CARD_OPTIONS}
                  onChange={(workCard) => setExtra({ ...extra, workCard })}
                />
                <Choices
                  label="Como ficou sabendo da vaga? *"
                  value={extra.source}
                  options={SOURCE_OPTIONS}
                  onChange={(source) => setExtra({ ...extra, source })}
                />
                <Choices
                  label="Consegue ficar o turno inteiro em pé? *"
                  value={extra.standing}
                  options={STANDING_OPTIONS}
                  onChange={(standing) => setExtra({ ...extra, standing })}
                />
                <Field label="Alguém que confirme seu último trabalho" hint="Nome e WhatsApp. Se for o primeiro emprego, deixe em branco.">
                  <Input
                    value={extra.reference}
                    onChange={(event) => setExtra({ ...extra, reference: event.target.value })}
                    placeholder="Ex.: Maria, (86) 90000-0000"
                  />
                </Field>
                <Field label="Alguma restrição de horário?" hint="Opcional">
                  <Textarea
                    rows={2}
                    value={extra.restriction}
                    onChange={(event) => setExtra({ ...extra, restriction: event.target.value })}
                    placeholder="Ex.: Preciso sair às terças até 18h."
                  />
                </Field>
                <div>
                  <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.45px] text-[#4A4636]">
                    Currículo (opcional)
                  </p>
                  <p className="mb-2 text-xs text-[var(--pv-muted)]">PDF, Word ou foto. Até 5 MB. Quem já se candidatou sem arquivo continua no painel.</p>
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--pv-line-strong)] bg-[#FBF9F3] px-3.5 py-3 text-sm text-[var(--pv-navy)] hover:bg-[#F1EDE0]">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Paperclip size={16} />
                      <span className="truncate">{resumeFileLabel(resume)}</span>
                    </span>
                    <span className="shrink-0 font-bold text-[var(--pv-terracotta)]">{resume ? 'Trocar' : 'Anexar'}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      className="sr-only"
                      onChange={(event) => pickResume(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {resume ? (
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--pv-muted)] hover:text-[var(--pv-navy)]"
                      onClick={() => setResume(null)}
                    >
                      <X size={12} /> Remover arquivo
                    </button>
                  ) : null}
                </div>
              </>
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
                setStep((current) => Math.max(0, current - 1))
              }}
            >
              Voltar
            </Button>
            <Button onClick={() => void nextStep()} disabled={saving}>
              {saving ? 'Enviando…' : step === LAST_STEP ? 'Enviar candidatura' : 'Continuar'}
            </Button>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  )
}

function Choices({
  label,
  options,
  value,
  values,
  onChange,
  onToggle,
}: {
  label: string
  options: readonly string[]
  value?: string
  values?: string[]
  onChange?: (next: string) => void
  onToggle?: (next: string) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.45px] text-[#4A4636]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values ? values.includes(option) : value === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => (onToggle ? onToggle(option) : onChange?.(option))}
              className={`rounded-xl px-3.5 py-2 text-sm font-bold transition ${
                selected
                  ? 'bg-[var(--pv-terracotta)] text-white'
                  : 'bg-[#F1EDE0] text-[var(--pv-ink)] hover:bg-[#E7E2D3]'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
