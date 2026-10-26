import { useCallback, useEffect, useState } from 'react'
import { FileText, Plus, RefreshCw, UserRound, UsersRound } from 'lucide-react'
import { Alert, Button, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui'
import { formatDateBR } from '@/lib/utils'
import {
  createRhCollaborator, listCollaboratorHistory, listRhCollaborators, listRhUnits,
  registerRhDocument, registerRhOccurrence, registerRhSid,
  type CollaboratorHistoryEvent, type RhCollaborator, type RhUnit,
} from '@/lib/collaboratorsDb'

type FormMode = 'occurrence' | 'sid' | 'document'
const today = () => new Date().toISOString().slice(0, 10)

export function CollaboratorsPage() {
  const [units, setUnits] = useState<RhUnit[]>([])
  const [collaborators, setCollaborators] = useState<RhCollaborator[]>([])
  const [selected, setSelected] = useState<RhCollaborator | null>(null)
  const [history, setHistory] = useState<CollaboratorHistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [mode, setMode] = useState<FormMode | null>(null)
  const [filter, setFilter] = useState('')

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
    setSelected(person); setHistory([]); setError('')
    try { setHistory((await listCollaboratorHistory(person.id)) || []) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o histórico.') }
  }
  const visible = collaborators.filter((person) => `${person.full_name} ${person.unit_name} ${person.job_title}`.toLowerCase().includes(filter.toLowerCase()))

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
        {loading ? <p className="py-10 text-center text-sm text-[var(--pv-muted)]">Carregando cadastro…</p> : visible.length === 0 ? <Empty onCreate={() => setShowCreate(true)} /> : <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{visible.map((person) => <button key={person.id} type="button" onClick={() => void openCollaborator(person)} className="group rounded-xl border border-[var(--pv-line)] bg-[#FFFDF9] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#E9856F] hover:shadow-lg"><div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8E8E3] text-[var(--pv-terracotta)]"><UserRound size={19} /></span><span className={person.status === 'ativo' ? 'rounded-md bg-[#E5F3EA] px-2 py-1 text-[10px] font-bold uppercase text-[#2D7D46]' : 'rounded-md bg-[#F1EDE0] px-2 py-1 text-[10px] font-bold uppercase text-[var(--pv-muted)]'}>{person.status}</span></div><h3 className="mt-3 font-bold text-[var(--pv-ink)] group-hover:text-[var(--pv-terracotta)]">{person.full_name}</h3><p className="mt-1 text-sm text-[var(--pv-muted)]">{person.job_title}</p><div className="mt-3 border-t border-[var(--pv-line)] pt-3 text-xs font-semibold text-[var(--pv-navy)]">{person.unit_name}{person.hired_on ? ` · Desde ${formatDateBR(person.hired_on)}` : ''}</div></button>)}</div>}
      </section>

      <CreateCollaboratorModal open={showCreate} units={units} saving={saving} onClose={() => setShowCreate(false)} onSave={async (input) => { setSaving(true); setError(''); try { await createRhCollaborator(input); setShowCreate(false); setNotice('Colaborador cadastrado com sucesso.'); await reload() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível cadastrar.') } finally { setSaving(false) } }} />
      <CollaboratorDetail person={selected} history={history} onClose={() => { setSelected(null); setMode(null) }} onOpenForm={(next) => setMode(next)} />
      <RecordModal mode={mode} person={selected} saving={saving} onClose={() => setMode(null)} onSave={async (input) => { if (!selected) return; setSaving(true); setError(''); try { if (input.mode === 'occurrence') await registerRhOccurrence({ collaboratorId: selected.id, ...input }); if (input.mode === 'sid') await registerRhSid({ collaboratorId: selected.id, ...input }); if (input.mode === 'document') await registerRhDocument({ collaboratorId: selected.id, ...input }); setMode(null); setNotice('Registro incluído no histórico funcional.'); setHistory((await listCollaboratorHistory(selected.id)) || []); await reload() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o registro.') } finally { setSaving(false) } }} />
    </div>
  )
}

function Empty({ onCreate }: { onCreate: () => void }) { return <div className="py-12 text-center"><UsersRound className="mx-auto text-[var(--pv-terracotta)]" size={28} /><h3 className="mt-3 font-display text-xl text-[var(--pv-ink)]">Nenhum colaborador ainda</h3><p className="mx-auto mt-2 max-w-md text-sm text-[var(--pv-muted)]">Comece pelo cadastro da primeira pessoa e depois registre as movimentações no histórico.</p><Button className="mt-5" onClick={onCreate}><Plus size={16} /> Cadastrar primeiro colaborador</Button></div> }

function CreateCollaboratorModal({ open, units, saving, onClose, onSave }: { open: boolean; units: RhUnit[]; saving: boolean; onClose: () => void; onSave: (input: { unitId: string; fullName: string; jobTitle: string; phone?: string; hiredOn?: string }) => Promise<void> }) {
  const [unitId, setUnitId] = useState(''); const [fullName, setFullName] = useState(''); const [jobTitle, setJobTitle] = useState(''); const [phone, setPhone] = useState(''); const [hiredOn, setHiredOn] = useState(today())
  useEffect(() => { if (open && !unitId && units[0]) setUnitId(units[0].id) }, [open, unitId, units])
  return <Modal open={open} title="Cadastrar colaborador" onClose={onClose} wide><form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void onSave({ unitId, fullName, jobTitle, phone, hiredOn }) }}><Alert tone="info">Este cadastro é para quem já faz parte do time. Candidatos devem continuar no funil de recrutamento.</Alert><Field label="Unidade"><Select value={unitId} onChange={(e) => setUnitId(e.target.value)} required><option value="">Selecione</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select></Field><Field label="Nome completo"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} /></Field><Field label="Cargo"><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required maxLength={80} placeholder="Ex.: Auxiliar de cozinha" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Telefone operacional"><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} /></Field><Field label="Data de admissão"><Input type="date" value={hiredOn} onChange={(e) => setHiredOn(e.target.value)} /></Field></div><div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving || !unitId}>{saving ? 'Salvando…' : 'Cadastrar colaborador'}</Button></div></form></Modal>
}

function CollaboratorDetail({ person, history, onClose, onOpenForm }: { person: RhCollaborator | null; history: CollaboratorHistoryEvent[]; onClose: () => void; onOpenForm: (mode: FormMode) => void }) {
  return <Modal open={Boolean(person)} title={person?.full_name || 'Colaborador'} onClose={onClose} wide>{person ? <div><p className="text-sm text-[var(--pv-muted)]">{person.job_title} · {person.unit_name}</p><div className="mt-5 grid gap-2 sm:grid-cols-3"><Button size="sm" onClick={() => onOpenForm('occurrence')}>Registrar ocorrência</Button><Button size="sm" variant="outline" onClick={() => onOpenForm('sid')}>Registrar SID</Button><Button size="sm" variant="outline" onClick={() => onOpenForm('document')}><FileText size={14} /> Documento</Button></div><div className="mt-6"><h3 className="font-display text-xl text-[var(--pv-ink)]">Histórico funcional</h3>{history.length ? <ol className="mt-3 space-y-3 border-l-2 border-[#F3D0C6] pl-4">{history.map((event) => <li key={event.id} className="relative"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--pv-terracotta)]" /><p className="text-xs font-bold text-[var(--pv-terracotta)]">{formatDateBR(event.event_date)}</p><p className="mt-0.5 text-sm font-bold text-[var(--pv-ink)]">{event.title}</p>{event.summary ? <p className="mt-1 text-sm text-[var(--pv-muted)]">{event.summary}</p> : null}</li>)}</ol> : <p className="mt-3 text-sm text-[var(--pv-muted)]">Ainda não há movimentações além do cadastro.</p>}</div></div> : null}</Modal>
}

function RecordModal({ mode, person, saving, onClose, onSave }: { mode: FormMode | null; person: RhCollaborator | null; saving: boolean; onClose: () => void; onSave: (input: any) => Promise<void> }) {
  const [kind, setKind] = useState('falta'); const [date, setDate] = useState(today()); const [notes, setNotes] = useState(''); const [days, setDays] = useState('1'); const [reference, setReference] = useState(''); const [category, setCategory] = useState('funcional'); const [docKind, setDocKind] = useState('holerite')
  const title = mode === 'occurrence' ? 'Registrar ocorrência' : mode === 'sid' ? 'Registrar SID' : 'Registrar documento'
  return <Modal open={Boolean(mode && person)} title={title} onClose={onClose}>{mode ? <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (mode === 'occurrence') void onSave({ mode, kind, occurredOn: date, note: notes, days: Number(days) || 1 }); if (mode === 'sid') void onSave({ mode, referenceCode: reference, category, occurredOn: date, notes }); if (mode === 'document') void onSave({ mode, kind: docKind, competence: date, notes }) }}><p className="text-sm text-[var(--pv-muted)]">{person?.full_name}</p>{mode === 'occurrence' ? <><Field label="Tipo"><Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="falta">Falta</option><option value="advertencia">Advertência</option><option value="atestado">Atestado</option><option value="suspensao">Suspensão</option></Select></Field><div className="grid grid-cols-2 gap-3"><Field label="Data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field><Field label="Dias"><Input type="number" min="1" max="60" value={days} onChange={(e) => setDays(e.target.value)} required /></Field></div><Field label="Observação" hint="Não escreva CID, diagnóstico ou laudo."><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field></> : null}{mode === 'sid' ? <><Field label="Código / referência SID"><Input value={reference} onChange={(e) => setReference(e.target.value)} required maxLength={80} /></Field><Field label="Categoria"><Select value={category} onChange={(e) => setCategory(e.target.value)}><option value="funcional">Funcional</option><option value="disciplinar">Disciplinar</option><option value="administrativo">Administrativo</option><option value="outro">Outro</option></Select></Field><Field label="Data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field><Field label="Observação"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field></> : null}{mode === 'document' ? <><Field label="Tipo de documento"><Select value={docKind} onChange={(e) => setDocKind(e.target.value)}><option value="holerite">Holerite</option><option value="exame_admissional">Exame admissional</option><option value="exame_periodico">Exame periódico</option><option value="aso">ASO</option><option value="contrato">Contrato</option><option value="ferias">Férias</option><option value="outro">Outro</option></Select></Field><Field label="Competência / data"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="Observação"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field></> : null}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar no histórico'}</Button></div></form> : null}</Modal>
}
