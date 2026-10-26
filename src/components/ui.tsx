import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'cream' | 'navy'
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition duration-150',
        'active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-terracotta)]',
        size === 'sm' && 'rounded-lg px-3 py-2 text-[12.5px]',
        size === 'md' && 'rounded-[10px] px-4 py-2.5 text-sm',
        size === 'lg' && 'rounded-xl px-5 py-3 text-[15px]',
        variant === 'primary' &&
          'bg-[var(--pv-terracotta)] text-white shadow-[0_8px_20px_rgba(225,91,63,0.28)] hover:bg-[var(--pv-terracotta-deep)]',
        variant === 'ghost' &&
          'border border-[var(--pv-line-strong)] bg-transparent text-[var(--pv-muted)] hover:bg-[#F7F4EC] hover:text-[var(--pv-navy)]',
        variant === 'outline' &&
          'border border-[rgba(239,227,196,0.4)] bg-transparent text-[var(--pv-cream)] hover:bg-white/8',
        variant === 'danger' && 'bg-[var(--pv-danger)] text-white hover:brightness-105',
        variant === 'cream' && 'bg-[var(--pv-cream)] text-[var(--pv-navy)] hover:brightness-95',
        variant === 'navy' && 'bg-[var(--pv-navy)] text-[var(--pv-cream)] hover:bg-[var(--pv-navy-light)]',
        className,
      )}
      {...props}
    />
  )
}

const fieldControl =
  'w-full rounded-xl border border-[var(--pv-line-strong)] bg-white px-3.5 py-2.5 text-[13.5px] text-[var(--pv-navy)] placeholder:text-[#A9A493] shadow-[inset_0_1px_2px_rgba(27,42,87,0.03)] transition focus-visible:border-[var(--pv-terracotta)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(225,91,63,0.15)]'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldControl, className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldControl, 'min-h-[84px] resize-y', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldControl, className)} {...props}>
      {children}
    </select>
  )
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.45px] text-[#4A4636]',
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  children,
  error,
  hint,
  labelClassName,
}: {
  label: string
  children: ReactNode
  error?: string
  hint?: string
  labelClassName?: string
}) {
  return (
    <div className="space-y-1">
      <Label className={labelClassName}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-[11.5px] text-[var(--pv-muted)]">{hint}</p> : null}
      {error ? <p className="text-xs font-semibold text-[var(--pv-danger)]">{error}</p> : null}
    </div>
  )
}

export function StatusPill({
  label,
  color,
  bg,
}: {
  label: string
  color: string
  bg: string
}) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  )
}

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'success' | 'error' | 'warning'
  children: ReactNode
  className?: string
}) {
  const styles = {
    info: 'bg-[#E8F1FA] text-[#3B6EA5]',
    success: 'bg-[var(--pv-success-bg)] text-[var(--pv-success)]',
    error: 'bg-[var(--pv-danger-bg)] text-[var(--pv-danger)]',
    warning: 'bg-[#FBF1DC] text-[#A6791F]',
  }
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertCircle : Info
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold',
        styles[tone],
        className,
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 leading-snug">{children}</div>
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  light = false,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  light?: boolean
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <p className="pv-eyebrow">{eyebrow}</p> : null}
        <h1
          className={cn(
            'font-display text-3xl sm:text-4xl',
            eyebrow ? 'mt-1' : '',
            light ? 'text-[var(--pv-navy)]' : 'text-[#F7F4EC]',
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className={cn('mt-2 text-sm leading-relaxed', light ? 'text-[var(--pv-muted)]' : 'pv-cream-text')}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Modal({
  open,
  title,
  children,
  onClose,
  wide,
  stacked,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  stacked?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={cn(
        'animate-fade-in fixed inset-0 flex items-end justify-center bg-[rgba(10,18,40,0.62)] p-0 backdrop-blur-[2px] sm:items-center sm:p-5',
        stacked ? 'z-[60]' : 'z-50',
      )}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'animate-fade-up max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-[var(--pv-surface)] shadow-2xl sm:rounded-2xl',
          wide ? 'max-w-xl' : 'max-w-md',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--pv-line)] bg-[var(--pv-surface)]/95 px-5 py-4 backdrop-blur">
          <h3 className="font-display text-xl text-[var(--pv-navy)]">{title}</h3>
          <button
            type="button"
            aria-label="Fechar"
            className="rounded-lg p-2 text-[var(--pv-muted)] transition hover:bg-[#F1EDE0] hover:text-[var(--pv-navy)]"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function NoticeModal({
  message,
  onClose,
  title = 'Atenção',
}: {
  message: string | null
  onClose: () => void
  title?: string
}) {
  return (
    <Modal open={Boolean(message)} title={title} onClose={onClose} stacked>
      <p className="text-sm leading-relaxed text-[var(--pv-ink)]">{message}</p>
      <div className="mt-5 flex justify-end">
        <Button onClick={onClose}>Entendi</Button>
      </div>
    </Modal>
  )
}

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F1EDE0] p-1" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={cn(
            'rounded-lg py-2.5 text-sm font-bold transition',
            value === opt.value
              ? 'bg-white text-[var(--pv-navy)] shadow-sm'
              : 'text-[var(--pv-muted)] hover:text-[var(--pv-navy)]',
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
