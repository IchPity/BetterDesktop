import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { useUi, type Toast } from '@/stores/ui'
import { cx } from '@/lib/format'

const icons: Record<Toast['tone'], React.JSX.Element> = {
  info: <Info className="h-4 w-4 text-info" />,
  success: <CircleCheck className="h-4 w-4 text-success" />,
  warning: <TriangleAlert className="h-4 w-4 text-warning" />,
  danger: <CircleAlert className="h-4 w-4 text-danger" />
}

export function Toaster(): React.JSX.Element {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[60] flex w-[340px] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            className={cx('panel pointer-events-auto flex items-start gap-3 bg-surface-2 px-3.5 py-3')}
          >
            <div className="mt-0.5">{icons[t.tone]}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">{t.title}</div>
              {t.description && <div className="mt-0.5 text-xs text-muted">{t.description}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-faint hover:text-fg">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
