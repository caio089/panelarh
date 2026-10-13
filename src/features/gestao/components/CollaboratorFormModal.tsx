import { useState, type FormEvent } from 'react'
import { Alert, Button, Field, Input, Modal, Select } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  emptyCollaboratorInput,
  formatPhone,
  inputFromCollaborator,
  validateCollaborator,
  type CollaboratorErrors,
  type CollaboratorInput,
} from '../collaboratorValidation'
import { CARGOS, GERENTE_CARGO, SCHEDULE_DAYS, SHIFT_PREFERENCE_LABEL } from '../escala/rules'
import type { Colaborador, ScheduleDayIndex, ShiftPreference } from '../types'

interface CollaboratorFormModalProps {
  open: boolean
  /** Quando informado, o formulário entra em modo edição. */
  colaborador: Colaborador | null
  unitName: string
  onClose: () => void
  onSubmit: (input: CollaboratorInput) => void
}

const PREFERENCES: ShiftPreference[] = ['manha', 'tarde', 'flexivel']

/** Cadastro/edição de colaborador. Remontado a cada abertura para reiniciar o estado. */
export function CollaboratorFormModal(props: CollaboratorFormModalProps) {
  if (!props.open) return null
  return <CollaboratorForm key={props.colaborador?.id ?? 'novo'} {...props} />
}

function CollaboratorForm({ colaborador, unitName, onClose, onSubmit }: CollaboratorFormModalProps) {
  const [values, setValues] = useState<CollaboratorInput>(() =>
    colaborador ? inputFromCollaborator(colaborador) : emptyCollaboratorInput(),
  )
  const [errors, setErrors] = useState<CollaboratorErrors>({})
  const [submitError, setSubmitError] = useState('')
  const isEditing = Boolean(colaborador)

  function update<K extends keyof CollaboratorInput>(key: K, value: CollaboratorInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function handleCargoChange(cargo: string) {
    setValues((prev) => ({ ...prev, cargo, isGerente: cargo === GERENTE_CARGO ? true : prev.isGerente }))
    if (errors.cargo) setErrors((prev) => ({ ...prev, cargo: undefined }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validation = validateCollaborator(values)
    setErrors(validation)
    if (Object.keys(validation).length > 0) return
    try {
      onSubmit(values)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Não foi possível salvar o colaborador.')
    }
  }

  return (
    <Modal open title={isEditing ? 'Editar colaborador' : `Novo colaborador · ${unitName}`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {submitError ? <Alert tone="error">{submitError}</Alert> : null}

        <Field label="Nome completo" error={errors.nome}>
          <Input
            value={values.nome}
            onChange={(e) => update('nome', e.target.value)}
            placeholder="Ex.: Maria da Silva"
            maxLength={80}
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cargo" error={errors.cargo}>
            <Select value={values.cargo} onChange={(e) => handleCargoChange(e.target.value)}>
              <option value="">Selecione…</option>
              {CARGOS.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Telefone (WhatsApp)" error={errors.telefone} hint="Opcional">
            <Input
              value={values.telefone}
              onChange={(e) => update('telefone', formatPhone(e.target.value))}
              placeholder="(86) 99999-9999"
              inputMode="tel"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data de admissão" error={errors.admissao}>
            <Input type="date" value={values.admissao} onChange={(e) => update('admissao', e.target.value)} />
          </Field>
          <Field label="Horário de entrada" error={errors.entradaPrevista} hint="Usado no controle de ponto">
            <Input type="time" value={values.entradaPrevista} onChange={(e) => update('entradaPrevista', e.target.value)} />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.45px] text-[#4A4636]">Turno preferido</p>
          <div className="grid grid-cols-3 gap-2">
            {PREFERENCES.map((pref) => (
              <ChoiceButton
                key={pref}
                active={values.turnoPreferido === pref}
                onClick={() => update('turnoPreferido', pref)}
                label={SHIFT_PREFERENCE_LABEL[pref]}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.45px] text-[#4A4636]">
            Folga preferida <span className="font-medium normal-case text-[var(--pv-muted)]">· a IA tenta respeitar</span>
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            <ChoiceButton active={values.folgaPreferida === null} onClick={() => update('folgaPreferida', null)} label="Tanto faz" />
            {SCHEDULE_DAYS.map((d) => (
              <ChoiceButton
                key={d.index}
                active={values.folgaPreferida === d.index}
                onClick={() => update('folgaPreferida', d.index as ScheduleDayIndex)}
                label={d.short}
              />
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2.5 rounded-xl border border-[var(--pv-line)] bg-white px-3.5 py-3 text-sm font-semibold text-[var(--pv-ink)]">
          <input
            type="checkbox"
            checked={values.isGerente}
            onChange={(e) => update('isGerente', e.target.checked)}
            className="h-4 w-4 accent-[var(--pv-terracotta)]"
          />
          É gerente da unidade
        </label>

        <div className="flex justify-end gap-2 border-t border-[var(--pv-line)] pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">{isEditing ? 'Salvar alterações' : 'Cadastrar colaborador'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function ChoiceButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg border px-2 py-2 text-xs font-bold transition',
        active
          ? 'border-[var(--pv-navy)] bg-[var(--pv-navy)] text-white'
          : 'border-[var(--pv-line-strong)] bg-white text-[var(--pv-muted)] hover:border-[var(--pv-navy)]/40',
      )}
    >
      {label}
    </button>
  )
}
