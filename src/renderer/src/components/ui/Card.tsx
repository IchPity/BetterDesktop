import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/format'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cx('panel relative overflow-hidden', className)} {...rest} />
}

export function CardHeader({
  icon,
  title,
  subtitle,
  actions,
  className
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cx('flex items-start gap-3 px-4 pt-3.5 pb-2', className)}>
      {icon && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold tracking-tight text-fg">{title}</div>
        {subtitle && <div className="truncate text-xs text-faint">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cx('px-4 pb-4', className)} {...rest} />
}
