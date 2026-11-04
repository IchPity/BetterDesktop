import { AnimatePresence, motion } from 'framer-motion'
import { Check, GripVertical, LayoutDashboard, Pencil, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_WIDGETS,
  WIDGET_SIZES,
  WIDGET_TYPES,
  type DashboardLayout,
  type WidgetInstance,
  type WidgetSize,
  type WidgetType
} from '@shared/settings'
import { Page, PageHeader } from '@/components/layout/Page'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/controls'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { cx } from '@/lib/format'
import { useSettings, useSettingsValue } from '@/stores/settings'
import { toast, useUi } from '@/stores/ui'
import { WIDGETS } from '../widgets/widgets'

/** 12-column grid spans per widget size, responsive to window width. */
const SPAN: Record<WidgetSize, string> = {
  sm: 'col-span-6 2xl:col-span-3',
  md: 'col-span-12 lg:col-span-6 2xl:col-span-4',
  lg: 'col-span-12 2xl:col-span-6',
  xl: 'col-span-12'
}
const SIZE_LABEL: Record<WidgetSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' }

/** Widgets announced for later phases – shown disabled in the catalog. */
const UPCOMING = [
  { title: 'Recent projects', phase: 3 },
  { title: 'Desktop Pet status', phase: 5 },
  { title: 'Notifications', phase: 5 }
]

const newId = (): string => `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function Overview(): React.JSX.Element {
  const settings = useSettingsValue()
  const update = useSettings((s) => s.update)
  const editing = useUi((s) => s.dashboardEditing)
  const setEditing = useUi((s) => s.setDashboardEditing)

  const { layouts, activeLayoutId } = settings.dashboard
  const active = layouts.find((l) => l.id === activeLayoutId) ?? layouts[0]

  // Local copy while dragging so reordering feels instant.
  const [widgets, setWidgets] = useState<WidgetInstance[]>(active.widgets)
  useEffect(() => setWidgets(active.widgets), [active])
  const [dragId, setDragId] = useState<string | null>(null)

  const [catalogOpen, setCatalogOpen] = useState(false)
  const [nameDialog, setNameDialog] = useState<null | 'new' | 'rename'>(null)
  const [confirm, setConfirm] = useState<null | 'delete' | 'restore'>(null)

  const saveLayouts = async (next: DashboardLayout[], activeId = activeLayoutId): Promise<void> => {
    try {
      await update({ dashboard: { layouts: next, activeLayoutId: activeId } })
    } catch (err) {
      toast({ tone: 'danger', title: 'Could not save layout', description: (err as Error).message })
    }
  }

  const saveWidgets = (next: WidgetInstance[]): Promise<void> => {
    setWidgets(next)
    return saveLayouts(layouts.map((l) => (l.id === active.id ? { ...l, widgets: next } : l)))
  }

  const removeWidget = (id: string): void => void saveWidgets(widgets.filter((w) => w.id !== id))
  const resizeWidget = (id: string, size: WidgetSize): void =>
    void saveWidgets(widgets.map((w) => (w.id === id ? { ...w, size } : w)))
  const addWidget = (type: WidgetType): void => {
    void saveWidgets([...widgets, { id: newId(), type, size: WIDGETS[type].defaultSize }])
    toast({ tone: 'success', title: `${WIDGETS[type].title} added` })
  }

  const onDragOver = (targetId: string): void => {
    if (!dragId || dragId === targetId) return
    setWidgets((cur) => {
      const from = cur.findIndex((w) => w.id === dragId)
      const to = cur.findIndex((w) => w.id === targetId)
      if (from < 0 || to < 0) return cur
      const next = cur.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }
  const onDragEnd = (): void => {
    setDragId(null)
    if (widgets.map((w) => w.id).join() !== active.widgets.map((w) => w.id).join()) void saveWidgets(widgets)
  }

  const used = useMemo(() => new Set(widgets.map((w) => w.type)), [widgets])

  return (
    <Page>
      <PageHeader
        icon={<LayoutDashboard />}
        title="Overview"
        description={editing ? 'Drag widgets to reorder, change their size or remove them.' : 'Your PC at a glance.'}
        actions={
          <>
            <LayoutPicker
              layouts={layouts}
              activeId={active.id}
              onChange={(id) => void saveLayouts(layouts, id)}
            />
            {editing ? (
              <>
                <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCatalogOpen(true)}>
                  Add widget
                </Button>
                <Button variant="ghost" icon={<Save className="h-4 w-4" />} onClick={() => setNameDialog('new')}>
                  Save as…
                </Button>
                <Button variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setNameDialog('rename')}>
                  Rename
                </Button>
                <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirm('restore')}>
                  Restore default
                </Button>
                {layouts.length > 1 && (
                  <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm('delete')}>
                    Delete
                  </Button>
                )}
                <Button variant="primary" icon={<Check className="h-4 w-4" />} onClick={() => setEditing(false)}>
                  Done
                </Button>
              </>
            ) : (
              <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Customize
              </Button>
            )}
          </>
        }
      />

      {widgets.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 py-16 text-center">
          <div className="text-[15px] font-semibold">This layout is empty</div>
          <div className="text-[13px] text-muted">Add widgets to build your dashboard.</div>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(true); setCatalogOpen(true) }}>
            Add widget
          </Button>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-12 gap-4">
          <AnimatePresence initial={false}>
            {widgets.map((w) => {
              const meta = WIDGETS[w.type]
              const C = meta.Component
              return (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: dragId === w.id ? 0.45 : 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                  className={cx('relative min-h-[200px]', SPAN[w.size])}
                  draggable={editing}
                  onDragStartCapture={(e: React.DragEvent) => {
                    e.dataTransfer.effectAllowed = 'move'
                    setDragId(w.id)
                  }}
                  onDragOverCapture={(e: React.DragEvent) => {
                    if (!dragId) return
                    e.preventDefault()
                    onDragOver(w.id)
                  }}
                  onDragEndCapture={onDragEnd}
                >
                  <div className={cx('h-full', editing && 'pointer-events-none select-none')}>
                    <C size={w.size} />
                  </div>
                  {editing && (
                    <div className="absolute inset-0 cursor-grab rounded-[14px] ring-1 ring-accent/40 ring-inset active:cursor-grabbing">
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-lg border border-border-strong bg-surface-2/95 p-1 shadow-lg backdrop-blur">
                        <GripVertical className="mx-0.5 h-3.5 w-3.5 text-faint" />
                        {WIDGET_SIZES.map((s) => (
                          <button
                            key={s}
                            onClick={() => resizeWidget(w.id, s)}
                            className={cx(
                              'h-6 min-w-6 rounded-md px-1 text-[11px] font-semibold transition-colors',
                              w.size === s ? 'bg-accent text-white' : 'text-muted hover:bg-surface-3 hover:text-fg'
                            )}
                            title={`Size ${SIZE_LABEL[s]}`}
                          >
                            {SIZE_LABEL[s]}
                          </button>
                        ))}
                        <button
                          onClick={() => removeWidget(w.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-danger/15 hover:text-danger"
                          title="Remove widget"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ---- widget catalog ---- */}
      <Modal
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        title="Add widget"
        description="Every widget shows real data from this PC."
        width="max-w-2xl"
      >
        <div className="grid grid-cols-2 gap-2">
          {WIDGET_TYPES.map((t) => {
            const m = WIDGETS[t]
            const added = used.has(t)
            return (
              <button
                key={t}
                disabled={added}
                onClick={() => addWidget(t)}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 text-left transition-colors hover:border-accent/50 disabled:opacity-50 disabled:hover:border-border"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent [&_svg]:h-4 [&_svg]:w-4">
                  {m.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{m.title}</div>
                  <div className="truncate text-xs text-muted">{m.description}</div>
                </div>
                {added && <Badge>Added</Badge>}
              </button>
            )
          })}
          {UPCOMING.map((u) => (
            <div
              key={u.title}
              className="flex items-center gap-3 rounded-xl border border-dashed border-border-strong p-3 opacity-60"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{u.title}</div>
                <div className="text-xs text-muted">Not implemented yet</div>
              </div>
              <Badge>Phase {u.phase}</Badge>
            </div>
          ))}
        </div>
      </Modal>

      {/* ---- layout name ---- */}
      <NameDialog
        open={nameDialog !== null}
        title={nameDialog === 'rename' ? 'Rename layout' : 'Save as new layout'}
        initial={nameDialog === 'rename' ? active.name : `${active.name} copy`}
        onCancel={() => setNameDialog(null)}
        onSubmit={(name) => {
          if (nameDialog === 'rename') {
            void saveLayouts(layouts.map((l) => (l.id === active.id ? { ...l, name } : l)))
          } else {
            if (layouts.length >= 20) {
              toast({ tone: 'warning', title: 'Layout limit reached', description: 'Delete a layout first (max. 20).' })
            } else {
              const id = `l-${Date.now().toString(36)}`
              void saveLayouts([...layouts, { id, name, widgets }], id)
              toast({ tone: 'success', title: `Layout "${name}" saved` })
            }
          }
          setNameDialog(null)
        }}
      />

      <ConfirmDialog
        open={confirm === 'restore'}
        title="Restore default widgets?"
        description={`The widgets in "${active.name}" will be replaced by the default set.`}
        confirmLabel="Restore"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void saveWidgets(structuredClone(DEFAULT_WIDGETS))
          setConfirm(null)
        }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        danger
        title={`Delete "${active.name}"?`}
        description="This layout will be removed permanently."
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const rest = layouts.filter((l) => l.id !== active.id)
          void saveLayouts(rest, rest[0].id)
          setConfirm(null)
        }}
      />
    </Page>
  )
}

function LayoutPicker({
  layouts,
  activeId,
  onChange
}: {
  layouts: DashboardLayout[]
  activeId: string
  onChange: (id: string) => void
}): React.JSX.Element {
  return (
    <select
      value={activeId}
      onChange={(e) => onChange(e.target.value)}
      className="h-8.5 rounded-lg border border-border bg-surface-3 px-2.5 text-[13px] font-medium text-fg outline-none hover:border-border-strong"
      title="Dashboard layout"
    >
      {layouts.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  )
}

function NameDialog({
  open,
  title,
  initial,
  onSubmit,
  onCancel
}: {
  open: boolean
  title: string
  initial: string
  onSubmit: (name: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState(initial)
  useEffect(() => {
    if (open) setName(initial)
  }, [open, initial])
  const valid = name.trim().length > 0 && name.trim().length <= 48
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSubmit(name.trim())}>
            Save
          </Button>
        </>
      }
    >
      <input
        autoFocus
        value={name}
        maxLength={48}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && valid && onSubmit(name.trim())}
        className="h-9 w-full rounded-lg border border-border-strong bg-surface-2 px-3 text-[13px] outline-none focus:border-accent"
        placeholder="Layout name"
      />
    </Modal>
  )
}
