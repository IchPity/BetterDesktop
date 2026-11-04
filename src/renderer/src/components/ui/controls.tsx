import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cx } from '@/lib/format'

/* ---------------------------------------------------------------- Badge */

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
const toneClass: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-muted border-border',
  accent: 'bg-accent-soft text-accent border-transparent',
  success: 'bg-success/12 text-success border-transparent',
  warning: 'bg-warning/12 text-warning border-transparent',
  danger: 'bg-danger/12 text-danger border-transparent',
  info: 'bg-info/12 text-info border-transparent'
}

export function Badge({
  tone = 'neutral',
  children,
  className
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cx(
        'inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[11px] font-medium whitespace-nowrap',
        toneClass[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

/* ---------------------------------------------------------------- Kbd */

export function Kbd({ children, className }: { children: ReactNode; className?: string }): React.JSX.Element {
  return (
    <kbd
      className={cx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border-strong bg-surface-2 px-1 font-sans text-[10.5px] font-medium text-muted',
        className
      )}
    >
      {children}
    </kbd>
  )
}

/* ---------------------------------------------------------------- Switch */

export function Switch({
  checked,
  onChange,
  disabled,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-40',
        checked ? 'border-transparent bg-accent' : 'border-border-strong bg-surface-3'
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        className={cx('h-3.5 w-3.5 rounded-full bg-white shadow', checked ? 'ml-[18px]' : 'ml-[2px]')}
      />
    </button>
  )
}

/* ---------------------------------------------------------------- Segmented */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  layoutId
}: {
  value: T
  options: Array<{ value: T; label: ReactNode }>
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  layoutId: string
}): React.JSX.Element {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              'relative inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
              size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-3 text-[12.5px]',
              active ? 'text-fg' : 'text-muted hover:text-fg'
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className="absolute inset-0 rounded-md border border-border-strong bg-surface-3 shadow-sm"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- Slider */

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  format
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  onCommit?: (v: number) => void
  format?: (v: number) => string
}): React.JSX.Element {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        className="h-1.5 w-44 cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_var(--accent)]"
        style={{ background: `linear-gradient(90deg, var(--accent) ${pct}%, var(--surface-3) ${pct}%)` }}
      />
      {format && <span className="tabular w-16 text-right text-xs text-muted">{format(value)}</span>}
    </div>
  )
}

/* ---------------------------------------------------------------- Empty / unavailable */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      {icon && (
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-2 text-faint [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      )}
      <div className="text-[13px] font-semibold text-fg">{title}</div>
      {description && <div className="max-w-sm text-xs leading-relaxed text-muted">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Inline marker for a metric this machine/OS does not expose. */
export function Unavailable({ reason, className }: { reason: string; className?: string }): React.JSX.Element {
  return (
    <span
      title={reason}
      className={cx(
        'inline-flex items-center gap-1 rounded border border-dashed border-border-strong px-1.5 text-[11px] text-faint',
        className
      )}
    >
      Not available
    </span>
  )
}

export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return <div className={cx('animate-pulse rounded-md bg-surface-3', className)} />
}

/* ---------------------------------------------------------------- Field row */

export function Field({
  label,
  description,
  children
}: {
  label: string
  description?: ReactNode
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border py-3.5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg">{label}</div>
        {description && <div className="mt-0.5 text-xs text-muted">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
