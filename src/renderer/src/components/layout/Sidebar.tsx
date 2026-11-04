import { motion } from 'framer-motion'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { MODULES, type ModuleMeta } from '@/modules/registry'
import { useUi } from '@/stores/ui'
import { useSettings, useSettingsValue } from '@/stores/settings'
import { useSystem } from '@/stores/system'
import { cx } from '@/lib/format'
import { Kbd } from '@/components/ui/controls'

const GROUPS: Array<{ id: ModuleMeta['group']; label: string }> = [
  { id: 'main', label: 'Workspace' },
  { id: 'tools', label: 'Tools' },
  { id: 'system', label: 'System' }
]

export function Sidebar(): React.JSX.Element {
  const settings = useSettingsValue()
  const update = useSettings((s) => s.update)
  const active = useUi((s) => s.module)
  const navigate = useUi((s) => s.navigate)
  const collapsed = settings.appearance.sidebarCollapsed

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 60 : 232 }}
      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      className="relative flex h-full shrink-0 flex-col border-r border-border bg-chrome"
    >
      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2.5 pt-2 pb-3">
        {GROUPS.map((g) => (
          <div key={g.id} className="mb-3">
            <div
              className={cx(
                'mb-1 h-5 px-2.5 text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase transition-opacity',
                collapsed && 'opacity-0'
              )}
            >
              {g.label}
            </div>
            {MODULES.filter((m) => m.group === g.id).map((m) => (
              <NavItem
                key={m.id}
                module={m}
                active={active === m.id}
                collapsed={collapsed}
                onClick={() => navigate(m.id)}
              />
            ))}
          </div>
        ))}
      </nav>

      <SidebarFooter collapsed={collapsed} />

      <button
        onClick={() => void update({ appearance: { sidebarCollapsed: !collapsed } })}
        title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
        className="mx-2.5 mb-2.5 flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        {collapsed ? <PanelLeftOpen className="h-4 w-4 shrink-0" /> : <PanelLeftClose className="h-4 w-4 shrink-0" />}
        {!collapsed && <span className="text-xs">Collapse</span>}
      </button>
    </motion.aside>
  )
}

function NavItem({
  module: m,
  active,
  collapsed,
  onClick
}: {
  module: ModuleMeta
  active: boolean
  collapsed: boolean
  onClick: () => void
}): React.JSX.Element {
  const Icon = m.icon
  return (
    <button
      onClick={onClick}
      title={collapsed ? `${m.label}${m.shortcut ? `  (Ctrl+${m.shortcut})` : ''}` : undefined}
      className={cx(
        'group relative flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors duration-150',
        active ? 'text-fg' : 'text-muted hover:bg-surface-2/70 hover:text-fg'
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          className="absolute inset-0 rounded-lg border border-border-strong bg-surface-2"
        >
          <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-accent" />
        </motion.span>
      )}
      <Icon className={cx('relative h-4 w-4 shrink-0', active && 'text-accent')} />
      {!collapsed && (
        <>
          <span className="relative flex-1 truncate text-[13px] font-medium">{m.label}</span>
          {m.status === 'planned' && (
            <span className="relative h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" title="Planned" />
          )}
          {m.shortcut && (
            <Kbd className="relative hidden group-hover:inline-flex">^{m.shortcut}</Kbd>
          )}
        </>
      )}
    </button>
  )
}

/** Mini live status in the sidebar footer. */
function SidebarFooter({ collapsed }: { collapsed: boolean }): React.JSX.Element | null {
  const snap = useSystem((s) => s.snapshot)
  if (collapsed) return null
  const mem = snap ? (snap.mem.used / snap.mem.total) * 100 : null
  return (
    <div className="mx-2.5 mb-2 rounded-lg border border-border bg-surface/60 px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
        <span className={cx('h-1.5 w-1.5 rounded-full', snap ? 'bg-success' : 'bg-faint')} />
        Live
      </div>
      <MiniStat label="CPU" value={snap?.cpu.load ?? null} />
      <MiniStat label="RAM" value={mem} />
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number | null }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-7 text-[11px] text-muted">{label}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
      <span className="tabular w-8 text-right text-[11px] text-fg">{value === null ? '—' : `${Math.round(value)}%`}</span>
    </div>
  )
}
