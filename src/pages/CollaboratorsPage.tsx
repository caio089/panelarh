import { useCallback, useEffect, useState } from 'react'
import { FileText, Plus, RefreshCw, UserRound, UsersRound } from 'lucide-react'
import { Alert, Button, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui'
import { formatDateBR } from '@/lib/utils'
import {
  createRhCollaborator, listCollaboratorHistory, listRhCollaborators, listRhUnits, loadCollaboratorDossier,
  registerRhDocument, registerRhOccurrence, registerRhSid,
  type CollaboratorDossier, type CollaboratorHistoryEvent, type RhCollaborator, type RhUnit,
} from '@/lib/collaboratorsDb'

type FormMode = 'falta' | 'atestado' | 'advertencia' | 'suspensao' | 'documento' | 'sid'

const RECORD_TITLE: Record<FormMode, string> = {
  falta: 'Registrar falta',
  atestado: 'Registrar atestado',
  advertencia: 'Registrar advertência',
  suspensao: 'Registrar suspensão',
  documento: 'Anexar documento',
  sid: 'Registrar SID',
}
const today = () => new Date().toISOString().slice(0, 10)

export function CollaboratorsPage() {
  const [units, setUnits] = useState<RhUnit[]>([])
  const [collaborators, setCollaborators] = useState<RhCollaborator[]>([])
  const [selected, setSelected] = useState<RhCollaborator | null>(null)
  const [dossier, setDossier] = useState<CollaboratorDossier | null>(null)
  const [history, setHistory] = useState<CollaboratorHistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [mode, setMode] = useState<FormMode | null>(null)
  const [filter, setFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('todas')

  const reload = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [nextUnits, nextCollaborators] = await Promise.all([listRhUnits(), listRhCollaborators()])
      setUnits(nextUnits || []); setCollaborators(nextCollaborators || [])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os colaboradores.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [reload])

  async function openCollaborator(person: RhCollaborator) {
    setSelected(person); setHistory([]); setDossier(null); setError('')
    try {
      const [nextHistory, nextDossier] = await Promise.all([
        listCollaboratorHistory(person.id),
        loadCollaboratorDossier(person.id),
      ])
      setHistory(nextHistory || [])
      setDossier(nextDossier)
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o histórico.') }
  }
  const visible = collaborators.filter((person) => `${person.full_name} ${person.unit_name} ${person.job_title}`.toLowerCase().includes(filter.toLowerCase()))
  const unitNames = [...new Set(collaborators.map((person) => person.unit_name))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const shown = unitFilter === 'todas' ? visible : visible.filter((person) => person.unit_name === unitFilter)
  const groups = unitNames
    .map((name) => ({ name, people: shown.filter((person) => person.unit_name === name) }))
    .filter((group) => group.people.length > 0)

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-8">
      <PageHeader
        eyebrow="Pessoas · cadastro operacional"
        title="Colaboradores"
        description="Cadastre o time por unidade e mantenha o histórico funcional em um único lugar. Candidatos continuam separados em Recrutamento."
        actions={<><Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Atualizar</Button><Button onClick={() => setShowCreate(true)}><Plus size={16} /> Novo colaborador</Button></>}
      />
      {error ? <Alert tone="error" className="mt-5">{error}</Alert> : null}
      {notice ? <Alert tone="success" className="mt-5">{notice}</Alert> : null}

      <section className="mt-6 overflow-hidden rounded-[24px] border border-[#FFB39F]/50 bg-gradient-to-br from-[#F06B4E] via-[var(--pv-terracotta)] to-[#B83E2C] p-5 shadow-[0_18px_38px_rgba(225,91,63,0.25)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div><p className="text-[11px] font-extrabold uppercase tracking-[1.5px] text-white/75">Base da operação</p><p className="mt-1 font-display text-3xl text-white">{loading ? '…' : collaborators.length} colaboradores cadastrados</p><p className="mt-2 text-sm text-white/85">Registre faltas, advertências, atestados, SID e documentos sem misturar informações médicas sensíveis.</p></div>
          <div className="rounded-2xl bg-white/15 px-4 py-3 text-center ring-1 ring-white/25"><p className="text-2xl font-bold text-white">{units.length}</p><p className="text-[11px] font-bold uppercase tracking-wide text-white/80">unidades</p></div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl bg-[var(--pv-surface)] p-4 shadow-xl sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-[var(--pv-ink)]"><UsersRound size={19} className="text-[var(--pv-terracotta)]" /><h2 className="font-display text-xl">Time cadastrado</h2></div><Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar pessoa, unidade ou cargo" className="max-w-xs" /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          <UnitChip active={unitFilter === 'todas'} label={`Todas · ${visible.length}`} onClick={() => setUnitFilter('todas')} />
          {unitNames.map((name) => <UnitChip key={name} active={unitFilter === name} label={`${name} · ${visible.filter((person) => person.unit_name === name).length}`} onClick={() => setUnitFilter(name)} />)}
        </div>
        {loading ? <p className="py-10 text-center text-sm text-[var(--pv-muted)]">Carregando cadastro…</p> : shown.length === 0 ? <Empty onCreate={() => setShowCreate(true)} /> : <div className="mt-5 space-y-6">{groups.map((group) => <div key={group.name}><h3 className="text-sm font-bold text-[var(--pv-navy)]">{group.name}</h3><div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{group.people.map((person) => <button key={person.id} type="button" onClick={() => void openCollaborator(person)} className="group rounded-xl border border-[var(--pv-line)] bg-[#FFFDF9] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#E9856F] hover:shadow-lg"><div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8E8E3] text-[var(--pv-terracotta)]"><UserRound size={19} /></span><span className={person.status === 'ativo' ? 'rounded-md bg-[#E5F3EA] px-2 py-1 text-[10px] font-bold uppercase text-[#2D7D46]' : 'rounded-md bg-[#F1EDE0] px-2 py-1 text-[10px] font-bold uppercase text-[var(--pv-muted)]'}>{person.status}</span></div><h3 className="mt-3 font-bold text-[var(--pv-ink)] group-hover:text-[var(--pv-terracotta)]">{person.full_name}</h3><p className="mt-1 text-sm text-[var(--pv-muted)]">{person.job_title}</p><div className="mt-3 border-t border-[var(--pv-line)] pt-3 text-xs font-semibold text-[var(--pv-navy)]">{person.unit_name}{person.hired_on ? ` · Desde ${formatDateBR(person.hired_on)}` : ''}</div></button>)}</div></div>)}</div>}
      </section>

      <CreateCollaboratorModal open={showCreate} units={units} saving={saving} onClose={() => setShowCreate(false)} onSave={async (input) => { setSaving(true); setError(''); try { await createRhCollaborator(input); setShowCreate(false); setNotice('Colaborador cadastrado com sucesso.'); await reload() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar.') } finally { setSaving(false) } }} />
      <CollaboratorDetail person={selected} dossier={dossier} history={history} onClose={() => { setSelected(null); setDossier(null); setMode(null) }} onOpenForm={(next) => setMode(next)} />
      <RecordModal mode={mode} person={selected} saving={saving} error={error} onClose={() => { setMode(null); setError('') }} onSave={async (input) => { if (!selected) return; setSaving(true); setError(''); try { if (input.mode === 'sid') await registerRhSid({ collaboratorId: selected.id, referenceCode: input.referenceCode, category: input.category, occurredOn: input.occurredOn, notes: input.notes }); else if (input.mode === 'documento') await registerRhDocument({ collaboratorId: selected.id, kind: input.kind, competence: input.competence, notes: input.notes }); else await registerRhOccurrence({ collaboratorId: selected.id, kind: input.mode, occurredOn: input.occurredOn, note: input.note, days: input.days }); setMode(null); setNotice('Registro incluído no histórico do colaborador.'); setHistory((await listCollaboratorHistory(selected.id)) || []); await reload() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o registro.') } finally { setSaving(false) } }} />
    </div>
  )
}

function Empty({ onCreate }: { onCreate: () => void }) { return <div className="py-12 text-center"><UsersRound className="mx-auto text-[var(--pv-terracotta)]" size={28} /><h3 className="mt-3 font-display text-xl text-[var(--pv-ink)]">Nenhum colaborador ainda</h3><p className="mx-auto mt-2 max-w-md text-sm text-[var(--pv-muted)]">Comece pelo cadastro da primeira pessoa e depois registre as movimentações no histórico.</p><Button className="mt-5" onClick={onCreate}><Plus size={16} /> Cadastrar primeiro colaborador</Button></div> }

function CreateCollaboratorModal({ open, units, saving, onClose, onSave }: { open: boolean; units: RhUnit[]; saving: boolean; onClose: () => void; onSave: (input: { unitId: string; fullName: string; jobTitle: string; phone?: string; hiredOn?: string }) => Promise<void> }) {
  const [unitId, setUnitId] = useState(''); const [fullName, setFullName] = useState(''); const [jobTitle, setJobTitle] = useState(''); const [phone, setPhone] = useState(''); const [hiredOn, setHiredOn] = useState(today())
  useEffect(() => { if (open && !unitId && units[0]) setUnitId(units[0].id) }, [open, unitId, units])
  return <Modal open={open} title="Cadastrar colaborador" onClose={onClose} wide><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void onSave({ unitId, fullName, jobTitle, phone, hiredOn }) }}><Alert tone="info">Este cadastro é para quem já faz parte do time. Candidatos devem continuar no funil de recrutamento.</Alert><Field label="Unidade"><Select value={unitId} onChange={(e) => setUnitId(e.target.value)} required><option value="">Selecione</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select></Field><Field label="Nome completo"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} /></Field><Field label="Cargo"><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required maxLength={80} placeholder="Ex.: Auxiliar de cozinha" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Telefone operacional"><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} /></Field><Field label="Data de admissão"><Input type="date" value={hiredOn} onChange={(e) => setHiredOn(e.target.value)} /></Field></div><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving || !unitId}>{saving ? 'Salvando…' : 'Cadastrar colaborador'}</Button></div></form></Modal>
}

function UnitChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={active ? 'rounded-full bg-[var(--pv-navy)] px-3 py-1.5 text-xs font-bold text-white' : 'rounded-full bg-[#F1EDE0] px-3 py-1.5 text-xs font-bold text-[var(--pv-navy)]'}>{label}</button>
}

function CollaboratorDetail({ person, dossier, history, onClose, onOpenForm }: { person: RhCollaborator | null; dossier: CollaboratorDossier | null; history: CollaboratorHistoryEvent[]; onClose: () => void; onOpenForm: (mode: FormMode) => void }) {
  const counts = history.reduce<Record<string, number>>((total, event) => {
    total[event.event_type] = (total[event.event_type] || 0) + 1
    return total
  }, {})
  return (
    <Modal open={Boolean(person)} title={person?.full_name || 'Colaborador'} onClose={onClose} wide>
      {person ? (
        <div>
          <p className="text-sm text-[var(--pv-muted)]">{person.job_title} · {person.unit_name}{dossier?.contract_type ? ` · ${dossier.contract_type}` : ''}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Button size="sm" onClick={() => onOpenForm('falta')}>Falta</Button>
            <Button size="sm" onClick={() => onOpenForm('atestado')}>Atestado</Button>
            <Button size="sm" onClick={() => onOpenForm('advertencia')}>Advertência</Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenForm('suspensao')}>Suspensão</Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenForm('documento')}><FileText size={14} /> Documento</Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenForm('sid')}>SID</Button>
          </div>
          <p className="mt-3 text-xs font-semibold text-[var(--pv-muted)]">
            {counts.falta || 0} faltas · {counts.atestado || 0} atestados · {counts.advertencia || 0} advertências · {counts.documento || 0} documentos
          </p>
          {dossier ? <Dossier dossier={dossier} /> : null}
          <div className="mt-6">
            <h3 className="font-display text-xl text-[var(--pv-ink)]">Histórico funcional</h3>
            {history.length ? (
              <ol className="mt-3 space-y-3 border-l-2 border-[#F3D0C6] pl-4">
                {history.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--pv-terracotta)]" />
                    <p className="text-xs font-bold text-[var(--pv-terracotta)]">{formatDateBR(event.event_date)}</p>
                    <p className="mt-0.5 text-sm font-bold text-[var(--pv-ink)]">{event.title}</p>
                    {event.summary ? <p className="mt-1 text-sm text-[var(--pv-muted)]">{event.summary}</p> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="mt-3 text-sm text-[var(--pv-muted)]">Ainda não há movimentações além do cadastro.</p>}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function Dossier({ dossier }: { dossier: CollaboratorDossier }) {
  const fields = [
    ['CPF', dossier.cpf],
    ['Nascimento', dossier.birth_date ? formatDateBR(dossier.birth_date) : null],
    ['Naturalidade', dossier.birth_place],
    ['E-mail', dossier.email],
    ['Telefone', dossier.operational_phone],
    ['Chave PIX', dossier.pix_key],
    ['Endereço', [dossier.address_line, dossier.neighborhood, dossier.city_state, dossier.postal_code].filter(Boolean).join(' · ')],
    ['CTPS', [dossier.ctps_number, dossier.ctps_series, dossier.ctps_state].filter(Boolean).join(' / ')],
    ['Matrícula eSocial', dossier.esocial_registration],
    ['Admissão', dossier.hired_on ? formatDateBR(dossier.hired_on) : null],
    ['Contrato', dossier.contract_type],
    ['Salário contratual', dossier.contractual_salary],
    ['Dependentes', dossier.dependents == null ? null : String(dossier.dependents)],
    ['Filhos', dossier.children_count == null ? null : String(dossier.children_count)],
    ['Salário-família', dossier.family_allowance],
    ['CNPJ da unidade', dossier.company_cnpj],
  ].filter((field): field is [string, string] => Boolean(field[1]))
  if (fields.length === 0) return null
  return <dl className="mt-5 grid gap-3 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="rounded-xl bg-[#F7F4EC] px-3 py-2"><dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--pv-muted)]">{label}</dt><dd className="mt-0.5 text-sm font-semibold text-[var(--pv-ink)]">{value}</dd></div>)}</dl>
}

function RecordModal({ mode, person, saving, error, onClose, onSave }: { mode: FormMode | null; person: RhCollaborator | null; saving: boolean; error: string; onClose: () => void; onSave: (input: { mode: FormMode; occurredOn: string; note: string; notes: string; days: number; referenceCode: string; category: string; kind: string; competence: string }) => Promise<void> }) {
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [days, setDays] = useState('1')
  const [reference, setReference] = useState('')
  const [category, setCategory] = useState('disciplinar')
  const [docKind, setDocKind] = useState('holerite')
  const occurrence = mode === 'falta' || mode === 'atestado' || mode === 'advertencia' || mode === 'suspensao'
  const asksDays = mode === 'falta' || mode === 'atestado' || mode === 'suspensao'

  useEffect(() => {
    if (!mode) return
    setDate(today())
    setNotes('')
    setDays('1')
    setReference('')
    setCategory(mode === 'advertencia' || mode === 'suspensao' ? 'disciplinar' : 'funcional')
    setDocKind('holerite')
  }, [mode])

  return (
    <Modal open={Boolean(mode && person)} title={mode ? RECORD_TITLE[mode] : 'Registro'} onClose={onClose}>
      {mode ? (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void onSave({ mode, occurredOn: date, note: notes, notes, days: Number(days) || 1, referenceCode: reference, category, kind: docKind, competence: date }) }}>
          <p className="text-sm text-[var(--pv-muted)]">{person?.full_name}</p>
          {occurrence ? (
            <>
              <div className={asksDays ? 'grid grid-cols-2 gap-3' : undefined}>
                <Field label="Data"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field>
                {asksDays ? <Field label={mode === 'atestado' ? 'Dias de afastamento' : 'Dias'}><Input type="number" min="1" max="60" value={days} onChange={(event) => setDays(event.target.value)} required /></Field> : null}
              </div>
              <Field label="Observação" hint="Não escreva CID, diagnóstico ou laudo."><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} /></Field>
            </>
          ) : null}
          {mode === 'sid' ? (
            <>
              <Field label="Código / referência SID"><Input value={reference} onChange={(event) => setReference(event.target.value)} required maxLength={80} /></Field>
              <Field label="Categoria"><Select value={category} onChange={(event) => setCategory(event.target.value)}><option value="disciplinar">Disciplinar</option><option value="funcional">Funcional</option><option value="administrativo">Administrativo</option><option value="outro">Outro</option></Select></Field>
              <Field label="Data"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field>
              <Field label="Observação"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} /></Field>
            </>
          ) : null}
          {mode === 'documento' ? (
            <>
              <Field label="Tipo de documento"><Select value={docKind} onChange={(event) => setDocKind(event.target.value)}><option value="holerite">Holerite</option><option value="exame_admissional">Exame admissional</option><option value="exame_periodico">Exame periódico</option><option value="aso">ASO</option><option value="contrato">Contrato</option><option value="ferias">Férias</option><option value="outro">Outro</option></Select></Field>
              <Field label="Competência / data"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
              <Field label="Observação"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} /></Field>
            </>
          ) : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar no histórico'}</Button>
          </div>
        </form>
      ) : null}
    </Modal>
  )
}
