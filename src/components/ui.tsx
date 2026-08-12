import { cn } from '@/lib/utils'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'cream'
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pv-terracotta)]',
        size === 'sm' && 'px-3 py-2 text-[12.5px] rounded-lg',
        size === 'md' && 'px-4 py-2.5 text-sm rounded-[10px]',
        size === 'lg' && 'px-5 py-3 text-[15px] rounded-xl',
        variant === 'primary' && 'bg-[var(--pv-terracotta)] text-white hover:brightness-105',
        variant === 'ghost' && 'bg-transparent border border-[#DCD9CE] text-[#5B5748] hover:bg-[#F7F4EC]',
        variant === 'outline' &&
          'bg-transparent border border-[rgba(239,227,196,0.35)] text-[var(--pv-cream)] hover:bg-white/5',
        variant === 'danger' && 'bg-[#B23B3B] text-white hover:brightness-105',
        variant === 'cream' && 'bg-[var(--pv-cream)] text-[var(--pv-navy)] hover:brightness-95',
        className,
      )}
      {...props}
    />
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-[#DCD9CE] bg-white px-3 py-2.5 text-[13.5px] text-[var(--pv-navy)] placeholder:text-[#A9A493] focus-visible:outline-2 focus-visible:outline-[var(--pv-terracotta)]',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full min-h-[72px] resize-y rounded-lg border border-[#DCD9CE] bg-white px-3 py-2.5 text-[13.5px] text-[var(--pv-navy)] placeholder:text-[#A9A493] focus-visible:outline-2 focus-visible:outline-[var(--pv-terracotta)]',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-lg border border-[#DCD9CE] bg-white px-3 py-2.5 text-[13.5px] text-[var(--pv-navy)] focus-visible:outline-2 focus-visible:outline-[var(--pv-terracotta)]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.4px] text-[#4A4636]',
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
  labelClassName,
}: {
  label: string
  children: ReactNode
  error?: string
  labelClassName?: string
}) {
  return (
    <div className="space-y-1">
      <Label className={labelClassName}>{label}</Label>
      {children}
      {error ? <p className="text-xs font-semibold text-[#B23B3B]">{error}</p> : null}
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
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  )
}
