import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, FileText, Plus, Search, UserRound } from 'lucide-react'
import { Alert, Button, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui'
import { formatDateBR } from '@/lib/utils'
import {
  createRhCollaborator,
  listCollaboratorHistory,
  listRhCollaborators,
  listRhUnits,
  loadCollaboratorDossier,
  registerRhDocument,
  registerRhOccurrence,
  type CollaboratorDossier,
  type CollaboratorHistoryEvent,
  type RhCollaborator,
  type RhUnit,
} from '@/lib/collaboratorsDb'

type FormMode = 'falta' | 'atestado' | 'advertencia' | 'suspensao' | 'documento'

const HOUSES = ['Dirceu', 'Promorar', 'Mocambinho'] as const
const RECORD_TITLE: Record<FormMode, string> = {
  falta: 'Registrar falta',
  atestado: 'Registrar atestado',
  advertencia: 'Registrar advertência',
  suspensao: 'Registrar suspensão',
  documento: 'Registrar documento',
}
const HISTORY_LABEL: Record<string, string> = {
  falta: 'Falta',
  atestado: 'Atestado',
  advertencia: 'Advertência',
  suspensao: 'Suspensão',
  documento: 'Documento',
  sid: 'SID',
  admissao: 'Admissão',
}

const today = () => new Date().toISOString().slice(0, 10)

function isHousePerson(person: RhCollaborator) {
  return HOUSES.includes(person.unit_name as (typeof HOUSES)[number]) && person.full_name.trim().toLowerCase() !== 'caio'
}

export function CollaboratorsPage() {
  const [units, setUnits] = useState<RhUnit[]>([])
  const [collaborators, setCollaborators] = useState<RhCollaborator[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dossier, setDossier] = useState<CollaboratorDossier | null>(null)
  const [history, setHistory] = useState<CollaboratorHistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [mode, setMode] = useState<FormMode | null>(null)
  const [filter, setFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('todas')

  const houseUnits = units.filter((unit) => HOUSES.includes(unit.name as (typeof HOUSES)[number]))
  const people = useMemo(() => collaborators.filter(isHousePerson), [collaborators])
  const selected = people.find((person) => person.id === selectedId) ?? null

  const visible = people.filter((person) => {
    const haystack = `${person.full_name} ${person.unit_name} ${person.job_title}`.toLowerCase()
    if (filter.trim() && !haystack.includes(filter.trim().toLowerCase())) return false
    if (unitFilter !== 'todas' && person.unit_name !== unitFilter) return false
    return true
  })

  const reload = useCallback(async () => {
    setLoading(true)
    setPageError('')
    try {
      const [nextUnits, nextCollaborators] = await Promise.all([listRhUnits(), listRhCollaborators()])
      setUnits(nextUnits || [])
      setCollaborators(nextCollaborators || [])
    } catch (reason) {
      setPageError(reason instanceof Error ? reason.message : 'Não foi possível carregar os colaboradores.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function openPerson(person: RhCollaborator) {
    setSelectedId(person.id)
    setMode(null)
    setFormError('')
    setDossier(null)
    setOpening(true)
    setPageError('')
    try {
      setHistory((await listCollaboratorHistory(person.id)) || [])
    } catch (reason) {
      setHistory([])
      setPageError(reason instanceof Error ? reason.message : 'Não foi possível abrir a ficha.')
    } finally {
      setOpening(false)
    }
  }

  async function revealFile() {
    if (!selected || dossier) return
    try {
      setDossier(await loadCollaboratorDossier(selected.id))
    } catch (reason) {
      setPageError(reason instanceof Error ? reason.message : 'Não foi possível carregar os dados da ficha.')
    }
  }

  async function saveRecord(input: RecordInput) {
    if (!selected) return
    setSaving(true)
    setFormError('')
    try {
      if (input.mode === 'documento') {
        await registerRhDocument({
          collaboratorId: selected.id,
          kind: input.kind,
          competence: input.competence,
          notes: input.notes,
        })
      } else {
        await registerRhOccurrence({
          collaboratorId: selected.id,
          kind: input.mode,
          occurredOn: input.occurredOn,
          note: input.note,
          days: input.days,
        })
      }
      setMode(null)
      setNotice(RECORD_TITLE[input.mode].replace('Registrar', 'Registrado'))
      setHistory((await listCollaboratorHistory(selected.id)) || [])
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Não foi possível salvar o registro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <PageHeader
        eyebrow="Departamento pessoal"
        title="Colaboradores"
        description="Escolha a pessoa e registre falta, atestado, advertência ou documento."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Nova pessoa
          </Button>
        }
      />

      {pageError ? <Alert tone="error" className="mt-5">{pageError}</Alert> : null}
      {notice ? <Alert tone="success" className="mt-5">{notice}</Alert> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <section className={selected ? 'hidden lg:block' : undefined}>
          <PeopleList
            loading={loading}
            people={visible}
            selectedId={selectedId}
            filter={filter}
            unitFilter={unitFilter}
            counts={people}
            onFilter={setFilter}
            onUnit={setUnitFilter}
            onOpen={(person) => void openPerson(person)}
          />
        </section>

        <section>
          {selected ? (
            <PersonPanel
              person={selected}
              dossier={dossier}
              history={history}
              loading={opening}
              mode={mode}
              saving={saving}
              formError={formError}
              onBack={() => {
                setSelectedId(null)
                setMode(null)
                setFormError('')
              }}
              onRecord={setMode}
              onRevealFile={() => void revealFile()}
              onSave={(input) => void saveRecord(input)}
            />
          ) : (
            <EmptyPanel />
          )}
        </section>
      </div>

      <CreateCollaboratorModal
        open={showCreate}
        units={houseUnits}
        saving={saving}
        onClose={() => setShowCreate(false)}
        onSave={async (input) => {
          setSaving(true)
          setPageError('')
          try {
            await createRhCollaborator(input)
            setShowCreate(false)
            setNotice('Pessoa cadastrada.')
            await reload()
          } catch (reason) {
            setPageError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar.')
          } finally {
            setSaving(false)
          }
        }}
      />
    </div>
  )
}

function PeopleList({
  loading,
  people,
  selectedId,
  filter,
  unitFilter,
  counts,
  onFilter,
  onUnit,
  onOpen,
}: {
  loading: boolean
  people: RhCollaborator[]
  selectedId: string | null
  filter: string
  unitFilter: string
  counts: RhCollaborator[]
  onFilter: (value: string) => void
  onUnit: (value: string) => void
  onOpen: (person: RhCollaborator) => void
}) {
  return (
    <div className="rounded-2xl bg-[var(--pv-surface)] p-4 shadow-xl">
      <label className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pv-muted)]" />
        <Input value={filter} onChange={(event) => onFilter(event.target.value)} placeholder="Buscar pelo nome" className="pl-9" />
      </label>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <UnitChip active={unitFilter === 'todas'} label={`Todas · ${counts.length}`} onClick={() => onUnit('todas')} />
        {HOUSES.map((name) => (
          <UnitChip
            key={name}
            active={unitFilter === name}
            label={`${name} · ${counts.filter((person) => person.unit_name === name).length}`}
            onClick={() => onUnit(name)}
          />
        ))}
      </div>
      {loading ? (
        <p className="py-10 text-center text-sm text-[var(--pv-muted)]">Carregando…</p>
      ) : people.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--pv-muted)]">Nenhuma pessoa com esse filtro.</p>
      ) : (
        <ul className="mt-3 max-h-[70vh] space-y-1 overflow-y-auto pr-1">
          {people.map((person) => {
            const active = person.id === selectedId
            return (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => onOpen(person)}
                  className={
                    active
                      ? 'flex w-full items-center gap-3 rounded-xl bg-[var(--pv-navy)] px-3 py-2.5 text-left text-white'
                      : 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#F7F4EC]'
                  }
                >
                  <span className={active ? 'flex h-9 w-9 items-center justify-center rounded-lg bg-white/10' : 'flex h-9 w-9 items-center justify-center rounded-lg bg-[#F8E8E3] text-[var(--pv-terracotta)]'}>
                    <UserRound size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{person.full_name}</span>
                    <span className={active ? 'block truncate text-xs text-white/70' : 'block truncate text-xs text-[var(--pv-muted)]'}>
                      {person.job_title} · {person.unit_name}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function PersonPanel({
  person,
  dossier,
  history,
  loading,
  mode,
  saving,
  formError,
  onBack,
  onRecord,
  onRevealFile,
  onSave,
}: {
  person: RhCollaborator
  dossier: CollaboratorDossier | null
  history: CollaboratorHistoryEvent[]
  loading: boolean
  mode: FormMode | null
  saving: boolean
  formError: string
  onBack: () => void
  onRecord: (mode: FormMode | null) => void
  onRevealFile: () => void
  onSave: (input: RecordInput) => void
}) {
  const [showFile, setShowFile] = useState(false)
  const counts = history.reduce<Record<string, number>>((total, event) => {
    total[event.event_type] = (total[event.event_type] || 0) + 1
    return total
  }, {})

  useEffect(() => {
    setShowFile(false)
  }, [person.id])

  return (
    <div className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl sm:p-6">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--pv-muted)] lg:hidden">
        <ArrowLeft size={15} /> Voltar à lista
      </button>
      <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-[var(--pv-terracotta)]">{person.unit_name}</p>
      <h2 className="mt-1 font-display text-2xl text-[var(--pv-ink)]">{person.full_name}</h2>
      <p className="mt-1 text-sm text-[var(--pv-muted)]">
        {person.job_title}
        {person.hired_on ? ` · Desde ${formatDateBR(person.hired_on)}` : ''}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <ActionButton strong active={mode === 'falta'} onClick={() => onRecord(mode === 'falta' ? null : 'falta')}>Falta</ActionButton>
        <ActionButton strong active={mode === 'atestado'} onClick={() => onRecord(mode === 'atestado' ? null : 'atestado')}>Atestado</ActionButton>
        <ActionButton strong active={mode === 'advertencia'} onClick={() => onRecord(mode === 'advertencia' ? null : 'advertencia')}>Advertência</ActionButton>
        <ActionButton active={mode === 'suspensao'} onClick={() => onRecord(mode === 'suspensao' ? null : 'suspensao')}>Suspensão</ActionButton>
        <ActionButton active={mode === 'documento'} onClick={() => onRecord(mode === 'documento' ? null : 'documento')}>
          <FileText size={14} /> Documento
        </ActionButton>
      </div>

      {mode ? (
        <RecordForm
          mode={mode}
          saving={saving}
          error={formError}
          onCancel={() => onRecord(null)}
          onSave={onSave}
        />
      ) : null}

      <p className="mt-4 text-xs font-semibold text-[var(--pv-muted)]">
        {counts.falta || 0} faltas · {counts.atestado || 0} atestados · {counts.advertencia || 0} advertências
      </p>

      <button
        type="button"
        onClick={() => {
          const next = !showFile
          setShowFile(next)
          if (next) onRevealFile()
        }}
        className="mt-5 text-sm font-bold text-[var(--pv-navy)]"
      >
        {showFile ? 'Ocultar dados da ficha' : 'Ver dados da ficha'}
      </button>
      {showFile ? <Dossier dossier={dossier} /> : null}

      <h3 className="mt-6 font-display text-xl text-[var(--pv-ink)]">Histórico</h3>
      {loading ? (
        <p className="mt-3 text-sm text-[var(--pv-muted)]">Abrindo ficha…</p>
      ) : history.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--pv-muted)]">Nada registrado ainda. Use os botões acima.</p>
      ) : (
        <ol className="mt-3 space-y-3 border-l-2 border-[#F3D0C6] pl-4">
          {history.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--pv-terracotta)]" />
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--pv-terracotta)]">
                {HISTORY_LABEL[event.event_type] || event.event_type} · {formatDateBR(event.event_date)}
              </p>
              <p className="mt-0.5 text-sm font-bold text-[var(--pv-ink)]">{event.title}</p>
              {event.summary ? <p className="mt-1 text-sm text-[var(--pv-muted)]">{event.summary}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function ActionButton({
  active,
  strong,
  onClick,
  children,
}: {
  active: boolean
  strong?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button size="sm" variant={active || strong ? 'primary' : 'ghost'} onClick={onClick}>
      {children}
    </Button>
  )
}

function EmptyPanel() {
  return (
    <div className="hidden h-full items-center justify-center rounded-2xl bg-[var(--pv-surface)] px-6 py-16 text-center shadow-xl lg:flex lg:min-h-[420px]">
      <div>
        <UserRound className="mx-auto text-[var(--pv-terracotta)]" size={28} />
        <p className="mt-3 font-display text-2xl text-[var(--pv-ink)]">Escolha uma pessoa</p>
        <p className="mt-2 text-sm text-[var(--pv-muted)]">A ficha abre ao lado. Dali você registra falta, atestado ou documento.</p>
      </div>
    </div>
  )
}

function UnitChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? 'rounded-full bg-[var(--pv-navy)] px-3 py-1.5 text-xs font-bold text-white' : 'rounded-full bg-[#F1EDE0] px-3 py-1.5 text-xs font-bold text-[var(--pv-navy)]'}
    >
      {label}
    </button>
  )
}

function CreateCollaboratorModal({
  open,
  units,
  saving,
  onClose,
  onSave,
}: {
  open: boolean
  units: RhUnit[]
  saving: boolean
  onClose: () => void
  onSave: (input: { unitId: string; fullName: string; jobTitle: string; phone?: string; hiredOn?: string }) => Promise<void>
}) {
  const [unitId, setUnitId] = useState('')
  const [fullName, setFullName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [hiredOn, setHiredOn] = useState(today())

  useEffect(() => {
    if (open && !unitId && units[0]) setUnitId(units[0].id)
  }, [open, unitId, units])

  return (
    <Modal open={open} title="Cadastrar pessoa" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          void onSave({ unitId, fullName, jobTitle, phone, hiredOn })
        }}
      >
        <Field label="Unidade">
          <Select value={unitId} onChange={(event) => setUnitId(event.target.value)} required>
            <option value="">Selecione</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Nome completo">
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={120} />
        </Field>
        <Field label="Cargo">
          <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} required maxLength={80} />
        </Field>
        <Field label="Data de admissão">
          <Input type="date" value={hiredOn} onChange={(event) => setHiredOn(event.target.value)} />
        </Field>
        <Field label="Telefone">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={20} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving || !unitId}>{saving ? 'Salvando…' : 'Cadastrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function Dossier({ dossier }: { dossier: CollaboratorDossier | null }) {
  if (!dossier) {
    return <p className="mt-3 text-sm text-[var(--pv-muted)]">Carregando dados da ficha…</p>
  }
  const fields = [
    ['CPF', dossier.cpf],
    ['Nascimento', dossier.birth_date ? formatDateBR(dossier.birth_date) : null],
    ['E-mail', dossier.email],
    ['Telefone', dossier.operational_phone],
    ['PIX', dossier.pix_key],
    ['Endereço', [dossier.address_line, dossier.neighborhood, dossier.city_state].filter(Boolean).join(' · ')],
    ['Contrato', dossier.contract_type],
    ['Salário', dossier.contractual_salary],
  ].filter((field): field is [string, string] => Boolean(field[1]))
  if (fields.length === 0) {
    return <p className="mt-3 text-sm text-[var(--pv-muted)]">Esta ficha ainda não tem dados cadastrais.</p>
  }
  return (
    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-[#F7F4EC] px-3 py-2">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--pv-muted)]">{label}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-[var(--pv-ink)]">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

interface RecordInput {
  mode: FormMode
  occurredOn: string
  note: string
  notes: string
  days: number
  kind: string
  competence: string
}

function RecordForm({
  mode,
  saving,
  error,
  onCancel,
  onSave,
}: {
  mode: FormMode
  saving: boolean
  error: string
  onCancel: () => void
  onSave: (input: RecordInput) => void
}) {
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [days, setDays] = useState('1')
  const [docKind, setDocKind] = useState('holerite')
  const occurrence = mode !== 'documento'
  const asksDays = mode === 'falta' || mode === 'atestado' || mode === 'suspensao'

  useEffect(() => {
    setDate(today())
    setNotes('')
    setDays('1')
    setDocKind('holerite')
  }, [mode])

  return (
    <form
      className="mt-4 space-y-3 rounded-2xl bg-[#F7F4EC] p-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSave({
          mode,
          occurredOn: date,
          note: notes,
          notes,
          days: Number(days) || 1,
          kind: docKind,
          competence: date,
        })
      }}
    >
      <p className="text-sm font-bold text-[var(--pv-navy)]">{RECORD_TITLE[mode]}</p>
      {occurrence ? (
        <>
          <div className={asksDays ? 'grid grid-cols-2 gap-3' : undefined}>
            <Field label="Data">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </Field>
            {asksDays ? (
              <Field label="Dias">
                <Input type="number" min="1" max="60" value={days} onChange={(event) => setDays(event.target.value)} required />
              </Field>
            ) : null}
          </div>
          <Field label="Observação" hint="Sem CID, diagnóstico ou laudo.">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Tipo">
            <Select value={docKind} onChange={(event) => setDocKind(event.target.value)}>
              <option value="holerite">Holerite</option>
              <option value="exame_admissional">Exame admissional</option>
              <option value="exame_periodico">Exame periódico</option>
              <option value="aso">ASO</option>
              <option value="contrato">Contrato</option>
              <option value="ferias">Férias</option>
              <option value="outro">Outro</option>
            </Select>
          </Field>
          <Field label="Data">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Observação">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} />
          </Field>
        </>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
      </div>
    </form>
  )
}
