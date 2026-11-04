import type { ReactNode } from 'react'
import { cx } from '@/lib/format'

export function Page({ children, className }: { children: ReactNode; className?: string }): React.JSX.Element {
  return <div className={cx('mx-auto w-full max-w-[1480px] px-7 pt-6 pb-10', className)}>{children}</div>
}

export function PageHeader({
  title,
  description,
  actions,
  icon
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-strong bg-surface-2 text-accent shadow-sm [&_svg]:h-5 [&_svg]:w-5">
            {icon}
          </div>
        )}
        <div>
          <h1 className="font-display text-[22px] leading-tight font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
