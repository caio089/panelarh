import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { dayDate } from '../../escala/week'
import { groupByCargo, type DayCoverage, type PersonSummary } from '../../escala/analysis'
import { SCHEDULE_DAYS, SHIFT_CODES, SHIFT_META } from '../../escala/rules'
import type { Colaborador, ScheduleAssignments, ScheduleDayIndex, ShiftCode } from '../../types'
import { Avatar } from '../atoms'

interface ScheduleGridProps {
  team: Colaborador[]
  weekStart: string
  assignments: ScheduleAssignments
  people: Record<string, PersonSummary>
  coverage: DayCoverage[]
  /** Células com problema (chave `${colaboradorId}-${dia}`). */
  flaggedCells: Set<string>
  onChange: (colaboradorId: string, day: ScheduleDayIndex, shift: ShiftCode | null) => void
}

const UNSET_VALUE = ''

/** Grade semanal editável, agrupada por cargo, com linha de cobertura no rodapé. */
export function ScheduleGrid({ team, weekStart, assignments, people, coverage, flaggedCells, onChange }: ScheduleGridProps) {
  const groups = groupByCargo(team)
  const today = new Date().toDateString()

  return (
    <div className="pv-scroll overflow-x-auto rounded-xl border border-[var(--pv-line)] bg-white">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead>
          <tr className="bg-[#F6F2E7] text-[10.5px] font-bold uppercase tracking-[0.6px] text-[var(--pv-muted)]">
            <th className="sticky left-0 z-10 bg-[#F6F2E7] px-4 py-3 text-left">Colaborador</th>
            {SCHEDULE_DAYS.map((d) => {
              const date = dayDate(weekStart, d.index)
              const isToday = date.toDateString() === today
              return (
                <th key={d.index} className="px-1.5 py-2 text-center">
                  <span className={cn('block', isToday && 'text-[var(--pv-terracotta)]')}>{d.short}</span>
                  <span
                    className={cn(
                      'mt-0.5 inline-block rounded-md px-1.5 text-[11px] font-bold normal-case tracking-normal',
                      isToday ? 'bg-[var(--pv-terracotta)] text-white' : 'text-[var(--pv-ink)]',
                    )}
                  >
                    {date.getDate()}
                  </span>
                </th>
              )
            })}
            <th className="px-3 py-3 text-center">Semana</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([cargo, members]) => (
            <Fragment key={cargo}>
              <tr className="bg-[#FBF9F3]">
                <td colSpan={9} className="sticky left-0 px-4 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-[1.2px] text-[var(--pv-terracotta)]">
                  {cargo} <span className="text-[#A9A493]">· {members.length}</span>
                </td>
              </tr>
              {members.map((c) => {
                const summary = people[c.id]
                return (
                  <tr key={c.id} className="border-t border-[var(--pv-line)]">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.nome} size={30} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-[var(--pv-ink)]">{c.nome}</p>
                          <p className="text-[10.5px] font-medium text-[var(--pv-muted)]">
                            {c.isGerente ? 'Gerente · ' : ''}prefere {c.turnoPreferido === 'flexivel' ? 'qualquer turno' : SHIFT_META[c.turnoPreferido].label.toLowerCase()}
                          </p>
                        </div>
                      </div>
                    </td>
                    {SCHEDULE_DAYS.map((d) => (
                      <td key={d.index} className="px-1 py-1.5 text-center">
                        <ShiftCell
                          value={assignments[c.id]?.[d.index] ?? null}
                          flagged={flaggedCells.has(`${c.id}-${d.index}`)}
                          preferredOff={c.folgaPreferida === d.index}
                          label={`${c.nome} · ${d.long}`}
                          onChange={(shift) => onChange(c.id, d.index, shift)}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <WeekSummary summary={summary} />
                    </td>
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--pv-line-strong)] bg-[#F6F2E7]">
            <td className="sticky left-0 z-10 bg-[#F6F2E7] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.8px] text-[var(--pv-muted)]">
              Cobertura mínima
            </td>
            {coverage.map((day) => (
              <td key={day.day} className="px-1 py-2 text-center">
                <CoverageBadge day={day} />
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function ShiftCell({
  value,
  flagged,
  preferredOff,
  label,
  onChange,
}: {
  value: ShiftCode | null
  flagged: boolean
  preferredOff: boolean
  label: string
  onChange: (shift: ShiftCode | null) => void
}) {
  const meta = value ? SHIFT_META[value] : null
  return (
    <div
      className={cn(
        'relative mx-auto flex h-11 w-full max-w-[96px] flex-col items-center justify-center rounded-lg border text-center transition hover:brightness-95',
        meta ? 'border-transparent' : 'border-dashed border-[var(--pv-line-strong)] bg-[#FDFCF8]',
        flagged && 'ring-2 ring-[var(--pv-danger)] ring-offset-1',
      )}
      style={meta ? { background: meta.bg, color: meta.color } : undefined}
      title={meta ? `${meta.label} · ${meta.hours}` : 'Clique para definir'}
    >
      <span className="text-[12px] font-bold leading-none">{meta ? meta.label : '—'}</span>
      {meta && value !== 'folga' ? <span className="mt-1 text-[9.5px] font-semibold opacity-75">{meta.hours.split(' – ')[0]}</span> : null}
      {preferredOff && value !== 'folga' ? (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--pv-success)]" title="Folga preferida" />
      ) : null}
      <select
        aria-label={label}
        value={value ?? UNSET_VALUE}
        onChange={(e) => onChange((e.target.value || null) as ShiftCode | null)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value={UNSET_VALUE}>— Sem definição</option>
        {SHIFT_CODES.map((code) => (
          <option key={code} value={code}>
            {SHIFT_META[code].label} ({SHIFT_META[code].hours})
          </option>
        ))}
      </select>
    </div>
  )
}

function WeekSummary({ summary }: { summary?: PersonSummary }) {
  if (!summary) return null
  const ok = summary.folgas === 1 && summary.undefinedDays === 0
  return (
    <div className="text-[11px] font-semibold leading-tight">
      <p className="text-[var(--pv-ink)]">{summary.worked} dias</p>
      <p className={ok ? 'text-[var(--pv-success)]' : summary.folgas === 0 && summary.undefinedDays === 0 ? 'text-[var(--pv-danger)]' : 'text-[#A9A493]'}>
        {summary.folgas} folga{summary.folgas === 1 ? '' : 's'}
      </p>
    </div>
  )
}

function CoverageBadge({ day }: { day: DayCoverage }) {
  const complete = day.covered >= day.required
  const tooltip = complete
    ? 'Demanda mínima atendida'
    : day.gaps.map((g) => `Falta ${g.missing} ${g.cargo} (${SHIFT_META[g.shift].label})`).join('\n')
  return (
    <div
      title={tooltip}
      className={cn(
        'mx-auto inline-flex flex-col items-center rounded-lg px-2 py-1 text-[11px] font-bold',
        complete ? 'bg-[var(--pv-success-bg)] text-[var(--pv-success)]' : 'bg-[#FBF1DC] text-[#A6791F]',
      )}
    >
      <span>
        {day.covered}/{day.required}
      </span>
      <span className="text-[9.5px] font-semibold opacity-80">
        {day.manha}M · {day.tarde}T
      </span>
    </div>
  )
}
