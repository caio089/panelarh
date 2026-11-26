import { useCallback, useEffect, useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { listRhCollaborators, listRhUnits, type RhCollaborator, type RhUnit } from '@/lib/collaboratorsDb'
import { formatMinutes, lateness, normalizeName, parseTimeReport, type ParsedReport } from '@/lib/timeReports'
import { listTimeReports, saveTimeReport, type SavedTimeReport } from '@/lib/timeReportsDb'

const brDate = (date: string) => date ? date.split('-').reverse().join('/') : '—'
const periodLabel = (from: string, to: string) => `${brDate(from)} a ${brDate(to)}`
export function TimeReportsPage() {
  const [units, setUnits] = useState<RhUnit[]>([])
  const [collaborators, setCollaborators] = useState<RhCollaborator[]>([])
  const [unitId, setUnitId] = useState('')
  const [reports, setReports] = useState<SavedTimeReport[]>([])
  const [preview, setPreview] = useState<ParsedReport | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tolerance, setTolerance] = useState(0)
  const [weekId, setWeekId] = useState('')
  const [date, setDate] = useState('')
  useEffect(() => {
    void Promise.all([listRhUnits(), listRhCollaborators()]).then(([nextUnits, nextPeople]) => {
      setUnits(nextUnits || []); setCollaborators(nextPeople || [])
      setUnitId((current) => current || nextUnits?.[0]?.id || '')
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o ponto.'))
  }, [])
  const reload = useCallback(async () => {
    if (!unitId) return
    try { setReports(await listTimeReports(unitId)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os relatórios.') }
  }, [unitId])
  useEffect(() => { void reload() }, [reload])
  const unitPeople = useMemo(() => collaborators.filter((person) => person.unit_id === unitId), [collaborators, unitId])
  const weeks = reports.filter((report) => report.kind === 'espelho')
  const week = weeks.find((report) => report.id === weekId) ?? weeks[0]
  const dates = [...new Set(week?.people.flatMap((person) => person.days.map((day) => day.date)) ?? [])].sort()
  const selectedDate = dates.includes(date) ? date : dates.at(-1) ?? ''
  const banks = reports.filter((report) => report.kind === 'banco')
  const balances = new Map<string, { balance: number; period: string }>()
  for (const bank of banks) for (const person of bank.people) {
    if (person.collaboratorId && person.balanceMinutes !== null && !balances.has(person.collaboratorId))
      balances.set(person.collaboratorId, { balance: person.balanceMinutes, period: periodLabel(bank.period_from, bank.period_to) })
  }
  const rows = unitPeople.map((collaborator) => {
    const person = week?.people.find((item) => item.collaboratorId === collaborator.id)
    const day = person?.days.find((item) => item.date === selectedDate)
    return { collaborator, day, bank: balances.get(collaborator.id) }
  }).filter((row) => row.day || row.bank)
  const unmatched = week?.people.filter((person) => !person.collaboratorId) ?? []
  async function openFile(file?: File) {
    if (!file) return
    if (!unitId) { setError('Selecione a unidade antes de importar.'); return }
    setBusy(true); setError(''); setNotice(''); setPreview(null)
    try {
      const parsed = await parseTimeReport(file)
      const used = new Set<string>()
      parsed.people = parsed.people.map((person) => {
        const matches = unitPeople.filter((candidate) => normalizeName(candidate.full_name) === normalizeName(person.sourceName))
        const match = matches.length === 1 && !used.has(matches[0].id) ? matches[0] : null
        if (match) used.add(match.id)
        return { ...person, collaboratorId: match?.id ?? null }
      })
      setPreview(parsed); setFileName(file.name)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'PDF inválido.') }
    finally { setBusy(false) }
  }
  function linkPerson(index: number, id: string) {
    setPreview((current) => current ? {
      ...current,
      people: current.people.map((person, personIndex) => personIndex === index ? { ...person, collaboratorId: id || null } : person),
    } : null)
  }
  async function save() {
    if (!preview || !unitId) return
    const linked = preview.people.map((person) => person.collaboratorId).filter(Boolean)
    if (new Set(linked).size !== linked.length) { setError('Há duas pessoas do relatório vinculadas ao mesmo colaborador.'); return }
    setBusy(true); setError('')
    try {
      await saveTimeReport(unitId, fileName, preview)
      await reload()
      setNotice(`${preview.kind === 'espelho' ? 'Espelho' : 'Banco de horas'} salvo para ${periodLabel(preview.from, preview.to)}.`)
      setPreview(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o relatório.') }
    finally { setBusy(false) }
  }
  return <div className="px-5 py-6 sm:px-8 sm:py-8">
    <PageHeader eyebrow="Departamento Pessoal" title="Ponto e banco de horas" description="Veja a hora de chegada, se houve atraso e o saldo do banco de horas de cada pessoa." />
    <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
      <section className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl">
        <h2 className="font-display text-xl text-[var(--pv-ink)]">Importar relatório</h2>
        <p className="mt-1 text-xs text-[var(--pv-muted)]">Escolha a unidade do PDF. Envie um espelho semanal ou extrato mensal em PDF.</p>
        <label className="mt-4 block text-xs font-bold text-[var(--pv-ink)]">Unidade
          <select className="mt-1 w-full rounded-xl border border-[var(--pv-line)] bg-white p-2.5 text-sm" value={unitId} onChange={(event) => { setUnitId(event.target.value); setPreview(null); setError(''); setWeekId('') }}>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
        </label>
        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--pv-terracotta)] bg-[#FFF6F2] p-5 text-sm font-bold text-[var(--pv-terracotta)]">
          <Upload size={18} /> {busy ? 'Lendo relatório…' : 'Selecionar PDF'}
          <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={(event) => { void openFile(event.target.files?.[0]); event.target.value = '' }} />
        </label>
        <p className="mt-3 text-xs text-[var(--pv-muted)]">Um novo envio para a mesma unidade, tipo e período substitui a importação anterior.</p>
      </section>
      <section className="rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl">
        <h2 className="font-display text-xl text-[var(--pv-ink)]">Atrasos</h2>
        <label className="mt-4 block text-xs font-bold text-[var(--pv-ink)]">Tolerância em minutos
          <input type="number" min="0" max="60" value={tolerance} onChange={(event) => setTolerance(Math.max(0, Math.min(60, Number(event.target.value) || 0)))} className="mt-1 w-28 rounded-xl border border-[var(--pv-line)] bg-white p-2.5 text-sm" />
        </label>
        <p className="mt-4 text-xs leading-relaxed text-[var(--pv-muted)]">A entrada é comparada com o horário previsto no espelho. Sem entrada válida, o atraso aparece como “—”. O banco de horas mostra o saldo do último extrato enviado.</p>
      </section>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-100 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-green-100 p-3 text-sm text-green-800">{notice}</p>}
    {preview && <section className="mt-5 rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl">
      <h2 className="font-display text-xl text-[var(--pv-ink)]">Conferir antes de salvar</h2>
      <p className="mt-1 text-sm text-[var(--pv-muted)]">{preview.kind === 'espelho' ? 'Espelho semanal' : 'Banco de horas'} · {periodLabel(preview.from, preview.to)} · {preview.company} · {preview.people.length} pessoas</p>
      <p className="mt-2 text-xs text-[var(--pv-muted)]">Associe os nomes sem correspondência. Pessoas não vinculadas não aparecem na tabela de ponto.</p>
      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {preview.people.map((person, index) => <div key={`${person.sourceName}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--pv-line)] bg-white p-2.5 text-sm">
          <span className="font-semibold text-[var(--pv-ink)]">{person.sourceName}</span>
          <select aria-label={`Vincular ${person.sourceName}`} className="max-w-full rounded-lg border border-[var(--pv-line)] p-1.5 text-xs" value={person.collaboratorId ?? ''} onChange={(event) => linkPerson(index, event.target.value)}>
            <option value="">Sem vínculo</option>{unitPeople.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>)}
          </select>
        </div>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-[var(--pv-terracotta)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar importação</button><button type="button" onClick={() => setPreview(null)} className="rounded-xl border border-[var(--pv-line)] px-4 py-2 text-sm font-bold text-[var(--pv-ink)]">Cancelar</button></div>
    </section>}
    <section className="mt-5 rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl text-[var(--pv-ink)]">Chegadas e banco de horas</h2><p className="text-xs text-[var(--pv-muted)]">{week ? `${periodLabel(week.period_from, week.period_to)} · ${week.company_name}` : 'Nenhum espelho importado para esta unidade.'}</p></div>
        <div className="flex flex-wrap gap-2">
          {weeks.length > 0 && <select aria-label="Semana" value={week?.id ?? ''} onChange={(event) => { setWeekId(event.target.value); setDate('') }} className="rounded-xl border border-[var(--pv-line)] bg-white p-2 text-sm">{weeks.map((item) => <option key={item.id} value={item.id}>{periodLabel(item.period_from, item.period_to)}</option>)}</select>}
          {dates.length > 0 && <select aria-label="Dia" value={selectedDate} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-[var(--pv-line)] bg-white p-2 text-sm">{dates.map((item) => <option key={item} value={item}>{brDate(item)}</option>)}</select>}
        </div>
      </div>
      {unmatched.length > 0 && <p className="mt-4 rounded-xl bg-amber-100 p-3 text-xs text-amber-900">{unmatched.length} nome(s) do espelho sem vínculo: {unmatched.map((person) => person.sourceName).join(', ')}. Reimporte o período para corrigir.</p>}
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead><tr className="border-b border-[var(--pv-line)] text-xs text-[var(--pv-muted)]"><th className="py-2">Colaborador</th><th>Chegou às</th><th>Atrasou?</th><th>Banco de horas</th></tr></thead><tbody>
        {rows.map(({ collaborator, day, bank }) => {
          const delay = day ? lateness(day, tolerance) : null
          return <tr key={collaborator.id} className="border-b border-[var(--pv-line)] text-[var(--pv-ink)]"><td className="py-3"><span className="font-bold">{collaborator.full_name}</span><span className="block text-xs text-[var(--pv-muted)]">{collaborator.job_title}</span></td><td className="font-semibold">{day?.entry ?? '—'}</td><td>{delay === null ? <span className="text-[var(--pv-muted)]">—</span> : delay > 0 ? <span className="font-bold text-[var(--pv-terracotta)]">Sim</span> : <span className="font-bold text-[var(--pv-success)]">Não</span>}</td><td className="font-bold">{formatMinutes(bank?.balance ?? null, true)}{bank && <span className="block text-[10px] font-normal text-[var(--pv-muted)]">{bank.period}</span>}</td></tr>
        })}
      </tbody></table>{rows.length === 0 && <p className="py-6 text-sm text-[var(--pv-muted)]">Ainda não há dados vinculados. Importe os relatórios e confira os nomes.</p>}</div>
    </section>
  </div>
}
