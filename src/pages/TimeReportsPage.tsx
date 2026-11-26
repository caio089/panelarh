import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileClock, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui'
import { listRhCollaborators, listRhUnits, type RhCollaborator, type RhUnit } from '@/lib/collaboratorsDb'
import { formatMinutes, lateness, normalizeName, parseTimeReport, type ParsedReport, type ReportPerson } from '@/lib/timeReports'
import { listTimeReports, saveTimeReport, type SavedTimeReport } from '@/lib/timeReportsDb'

const brDate = (date: string) => date ? date.split('-').reverse().join('/') : '—'
const periodLabel = (from: string, to: string) => `${brDate(from)} a ${brDate(to)}`
function dataForWeek(people: ReportPerson[], tolerance: number) {
  const days = people.flatMap((person) => person.days)
  const worked = days.reduce((sum, day) => sum + (day.workedMinutes ?? 0), 0)
  const late = days.map((day) => lateness(day, tolerance)).filter((value): value is number => value !== null && value > 0)
  return { worked, lateCount: late.length, lateMinutes: late.reduce((sum, value) => sum + value, 0), pending: days.filter((day) => day.status !== 'ok').length }
}
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
  const [detailId, setDetailId] = useState<string | null>(null)
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
  const banks = reports.filter((report) => report.kind === 'banco')
  const balances = new Map<string, { balance: number; period: string }>()
  for (const bank of banks) for (const person of bank.people) {
    if (person.collaboratorId && person.balanceMinutes !== null && !balances.has(person.collaboratorId))
      balances.set(person.collaboratorId, { balance: person.balanceMinutes, period: periodLabel(bank.period_from, bank.period_to) })
  }
  const rows = unitPeople.map((collaborator) => {
    const person = week?.people.find((item) => item.collaboratorId === collaborator.id)
    return { collaborator, person, stats: dataForWeek(person ? [person] : [], tolerance), bank: balances.get(collaborator.id) }
  }).filter((row) => row.person || row.bank)
  const totals = dataForWeek(week?.people.filter((person) => person.collaboratorId) ?? [], tolerance)
  const balanceValues = banks[0]?.people.filter((person) => person.collaboratorId).map((person) => person.balanceMinutes ?? 0) ?? []
  const totalCredit = balanceValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0)
  const totalDebit = balanceValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0)
  const unmatched = week?.people.filter((person) => !person.collaboratorId) ?? []
  const selected = rows.find((row) => row.collaborator.id === detailId)
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
    <PageHeader eyebrow="Departamento Pessoal" title="Ponto e banco de horas" description="Importe o espelho de ponto semanal e o extrato do banco de horas emitidos pelo sistema. Confira atrasos, horas realizadas e saldos oficiais por pessoa." />
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
        <h2 className="font-display text-xl text-[var(--pv-ink)]">Critérios de conferência</h2>
        <label className="mt-4 block text-xs font-bold text-[var(--pv-ink)]">Tolerância de atraso para esta visualização (minutos)
          <input type="number" min="0" max="60" value={tolerance} onChange={(event) => setTolerance(Math.max(0, Math.min(60, Number(event.target.value) || 0)))} className="mt-1 w-28 rounded-xl border border-[var(--pv-line)] bg-white p-2.5 text-sm" />
        </label>
        <p className="mt-4 text-xs leading-relaxed text-[var(--pv-muted)]">Atraso = entrada realizada após o horário contratual do espelho, descontada a tolerância escolhida. Dia sem batida ou jornada incompleta fica pendente de conferência; não vira falta ou débito automaticamente.</p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--pv-muted)]">O saldo do banco vem do extrato do sistema e já incorpora seus lançamentos. As horas do espelho não são somadas novamente ao saldo. Saldo positivo indica crédito a analisar para compensação ou pagamento; saldo negativo requer conferência com o DP.</p>
      </section>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-100 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-green-100 p-3 text-sm text-green-800">{notice}</p>}
    {preview && <section className="mt-5 rounded-2xl bg-[var(--pv-surface)] p-5 shadow-xl">
      <h2 className="font-display text-xl text-[var(--pv-ink)]">Conferir antes de salvar</h2>
      <p className="mt-1 text-sm text-[var(--pv-muted)]">{preview.kind === 'espelho' ? 'Espelho semanal' : 'Banco de horas'} · {periodLabel(preview.from, preview.to)} · {preview.company} · {preview.people.length} pessoas</p>
      <p className="mt-2 text-xs text-[var(--pv-muted)]">Associe os nomes sem correspondência. Pessoas não vinculadas ficam no relatório, mas não entram nos totais individuais.</p>
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
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl text-[var(--pv-ink)]">Conferência semanal</h2><p className="text-xs text-[var(--pv-muted)]">{week ? `${periodLabel(week.period_from, week.period_to)} · ${week.company_name}` : 'Nenhum espelho importado para esta unidade.'}</p></div>
        {weeks.length > 0 && <select aria-label="Semana" value={week?.id ?? ''} onChange={(event) => { setWeekId(event.target.value); setDetailId(null) }} className="rounded-xl border border-[var(--pv-line)] bg-white p-2 text-sm">{weeks.map((item) => <option key={item.id} value={item.id}>{periodLabel(item.period_from, item.period_to)}</option>)}</select>}
      </div>
      {(week || banks.length > 0) && <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Metric label="Horas realizadas" value={formatMinutes(totals.worked)} />
        <Metric label="Entradas atrasadas" value={String(totals.lateCount)} />
        <Metric label="Minutos de atraso" value={formatMinutes(totals.lateMinutes)} />
        <Metric label="Dias para conferir" value={String(totals.pending)} />
        <Metric label="Créditos no último extrato" value={banks.length ? formatMinutes(totalCredit) : '—'} />
        <Metric label="Débitos no último extrato" value={banks.length ? formatMinutes(totalDebit) : '—'} />
      </div>}
      {unmatched.length > 0 && <p className="mt-4 rounded-xl bg-amber-100 p-3 text-xs text-amber-900">{unmatched.length} nome(s) do espelho sem vínculo: {unmatched.map((person) => person.sourceName).join(', ')}. Reimporte o período para corrigir.</p>}
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-[var(--pv-line)] text-xs text-[var(--pv-muted)]"><th className="py-2">Colaborador</th><th>Realizadas</th><th>Atrasos</th><th>Pendências</th><th>Saldo oficial</th><th>Leitura do saldo</th></tr></thead><tbody>
        {rows.map(({ collaborator, person, stats, bank }) => <tr key={collaborator.id} className="border-b border-[var(--pv-line)] text-[var(--pv-ink)]"><td className="py-3"><button className="text-left font-bold text-[var(--pv-terracotta)] hover:underline" onClick={() => setDetailId(detailId === collaborator.id ? null : collaborator.id)}>{collaborator.full_name}</button><span className="block text-xs text-[var(--pv-muted)]">{collaborator.job_title}</span></td><td>{person ? formatMinutes(stats.worked) : '—'}</td><td>{person ? `${stats.lateCount} · ${formatMinutes(stats.lateMinutes)}` : '—'}</td><td>{person ? stats.pending : '—'}</td><td className="font-bold">{formatMinutes(bank?.balance ?? null, true)}{bank && <span className="block text-[10px] font-normal text-[var(--pv-muted)]">{bank.period}</span>}</td><td>{bank ? bank.balance > 0 ? 'Crédito a analisar' : bank.balance < 0 ? 'Débito a conferir' : 'Zerado' : 'Sem extrato'}</td></tr>)}
      </tbody></table>{rows.length === 0 && <p className="py-6 text-sm text-[var(--pv-muted)]">Ainda não há dados vinculados. Importe os relatórios e confira os nomes.</p>}</div>
      {selected?.person && <div className="mt-5 rounded-xl bg-[#F7F4EC] p-4"><h3 className="font-bold text-[var(--pv-ink)]">{selected.collaborator.full_name} · dias do espelho</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[580px] text-left text-xs"><thead><tr><th>Data</th><th>Batidas originais</th><th>Entrada / prevista</th><th>Trabalhadas</th><th>Atraso</th><th>Conferência</th></tr></thead><tbody>{selected.person.days.map((day) => <tr key={day.date} className="border-t border-[var(--pv-line)]"><td className="py-2">{brDate(day.date)}</td><td>{day.punches.join(' · ') || '—'}</td><td>{day.entry ?? '—'} / {day.expectedEntry ?? '—'}</td><td>{formatMinutes(day.workedMinutes)}</td><td>{lateness(day, tolerance) === null ? '—' : formatMinutes(lateness(day, tolerance))}</td><td>{day.status === 'ok' ? 'OK' : day.status === 'incompleto' ? 'Batida incompleta' : 'Sem batida'}</td></tr>)}</tbody></table></div></div>}
      {banks.length > 0 && <p className="mt-4 text-xs text-[var(--pv-muted)]">Saldo oficial mais recente por colaborador; o extrato pode cobrir um período diferente da semana selecionada. Confira o período antes de decidir pagamento.</p>}
    </section>
    <Link to="/admin/colaboradores" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--pv-cream)]"><FileClock size={16} /> Abrir cadastro de colaboradores</Link>
  </div>
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#F7F4EC] p-3"><p className="text-xs font-semibold text-[var(--pv-muted)]">{label}</p><p className="mt-1 font-display text-2xl text-[var(--pv-ink)]">{value}</p></div> }
