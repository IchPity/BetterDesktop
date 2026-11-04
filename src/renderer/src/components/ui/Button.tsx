import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cx } from '@/lib/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'icon' | 'icon-sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_4px_14px_-6px_var(--accent)] hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-3 text-fg border border-border hover:bg-surface-2 hover:border-border-strong',
  outline: 'bg-transparent text-fg border border-border-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95'
}

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-8.5 px-3.5 text-[13px] gap-2 rounded-lg',
  icon: 'h-8.5 w-8.5 rounded-lg justify-center',
  'icon-sm': 'h-7 w-7 rounded-md justify-center'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center font-medium whitespace-nowrap transition-[background,color,border,filter] duration-150 select-none',
        'disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
})
