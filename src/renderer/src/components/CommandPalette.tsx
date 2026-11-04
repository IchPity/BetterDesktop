import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  CornerDownLeft,
  FolderOpen,
  LayoutDashboard,
  ListTree,
  Moon,
  PanelLeft,
  Palette,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Laptop,
  Wrench
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ACCENTS, type AccentName } from '@shared/settings'
import { SYSTEM_TOOLS, type SystemTool } from '@shared/app'
import { MODULES } from '@/modules/registry'
import { fuzzyHighlights, fuzzyScore } from '@/lib/fuzzy'
import { cx } from '@/lib/format'
import { useSettings } from '@/stores/settings'
import { toast, useUi } from '@/stores/ui'
import { Kbd } from './ui/controls'

export interface Command {
  id: string
  title: string
  category: 'Navigation' | 'Actions' | 'Appearance' | 'Dashboard' | 'Windows tools'
  icon: ReactNode
  keywords?: string
  hint?: string
  run: () => void | Promise<void>
}

function useCommands(): Command[] {
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const navigate = useUi((s) => s.navigate)
  const setEditing = useUi((s) => s.setDashboardEditing)

  return useMemo(() => {
    if (!settings) return []
    const cmds: Command[] = []

    for (const m of MODULES) {
      const Icon = m.icon
      cmds.push({
        id: `nav:${m.id}`,
        title: `Go to ${m.label}`,
        category: 'Navigation',
        icon: <Icon />,
        keywords: m.description,
        hint: m.shortcut ? `Ctrl ${m.shortcut}` : m.status === 'planned' ? 'Planned' : undefined,
        run: () => navigate(m.id)
      })
    }

    cmds.push(
      {
        id: 'act:processes',
        title: 'Open process manager',
        category: 'Actions',
        icon: <ListTree />,
        keywords: 'task kill end tasks running programs',
        run: () => navigate('pc', 'processes')
      },
      {
        id: 'act:data-folder',
        title: 'Open BetterDesktop data folder',
        category: 'Actions',
        icon: <FolderOpen />,
        run: async () => {
          const r = await window.bd.app.openDataFolder()
          if (!r.ok) toast({ tone: 'danger', title: 'Could not open folder', description: r.error })
        }
      },
      {
        id: 'act:reload',
        title: 'Reload interface',
        category: 'Actions',
        icon: <RefreshCw />,
        run: () => location.reload()
      }
    )

    for (const [tool, label] of Object.entries(SYSTEM_TOOLS) as Array<[SystemTool, string]>) {
      cmds.push({
        id: `tool:${tool}`,
        title: `Open ${label}`,
        category: 'Windows tools',
        icon: <Wrench />,
        run: async () => {
          const r = await window.bd.app.launchTool(tool)
          if (!r.ok) toast({ tone: 'danger', title: `Could not open ${label}`, description: r.error })
        }
      })
    }

    const themes = [
      { v: 'dark', label: 'Dark', icon: <Moon /> },
      { v: 'light', label: 'Light', icon: <Sun /> },
      { v: 'system', label: 'System', icon: <Laptop /> }
    ] as const
    for (const t of themes) {
      cmds.push({
        id: `theme:${t.v}`,
        title: `Theme: ${t.label}`,
        category: 'Appearance',
        icon: t.icon,
        hint: settings.appearance.theme === t.v ? 'Active' : undefined,
        run: () => update({ appearance: { theme: t.v } })
      })
    }
    for (const a of Object.keys(ACCENTS) as AccentName[]) {
      cmds.push({
        id: `accent:${a}`,
        title: `Accent color: ${a[0].toUpperCase()}${a.slice(1)}`,
        category: 'Appearance',
        icon: <Palette style={{ color: ACCENTS[a] }} />,
        hint: settings.appearance.accent === a ? 'Active' : undefined,
        run: () => update({ appearance: { accent: a } })
      })
    }
    cmds.push(
      {
        id: 'app:sidebar',
        title: 'Toggle sidebar',
        category: 'Appearance',
        icon: <PanelLeft />,
        hint: 'Ctrl B',
        run: () => update({ appearance: { sidebarCollapsed: !settings.appearance.sidebarCollapsed } })
      },
      {
        id: 'app:motion',
        title: settings.appearance.reduceMotion ? 'Enable animations' : 'Reduce motion',
        category: 'Appearance',
        icon: <Sparkles />,
        run: () => update({ appearance: { reduceMotion: !settings.appearance.reduceMotion } })
      },
      {
        id: 'dash:edit',
        title: 'Customize dashboard',
        category: 'Dashboard',
        icon: <Pencil />,
        keywords: 'widgets edit layout',
        run: () => {
          navigate('overview')
          setEditing(true)
        }
      }
    )
    for (const l of settings.dashboard.layouts) {
      cmds.push({
        id: `dash:layout:${l.id}`,
        title: `Dashboard layout: ${l.name}`,
        category: 'Dashboard',
        icon: <LayoutDashboard />,
        hint: settings.dashboard.activeLayoutId === l.id ? 'Active' : undefined,
        run: async () => {
          await update({ dashboard: { activeLayoutId: l.id } })
          navigate('overview')
        }
      })
    }
    return cmds
  }, [settings, update, navigate, setEditing])
}

export function CommandPalette(): React.JSX.Element {
  const open = useUi((s) => s.paletteOpen)
  const setOpen = useUi((s) => s.setPaletteOpen)
  const recent = useSettings((s) => s.settings?.commandPalette.recent ?? [])
  const update = useSettings((s) => s.update)
  const commands = useCommands()

  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
    }
  }, [open])

  /** Flat ordered list + group headers. */
  const results = useMemo(() => {
    if (!query.trim()) {
      const byId = new Map(commands.map((c) => [c.id, c]))
      const rec = recent.map((id) => byId.get(id)).filter((c): c is Command => !!c).slice(0, 5)
      const recIds = new Set(rec.map((c) => c.id))
      return [
        ...rec.map((c) => ({ cmd: c, group: 'Recent' })),
        ...commands.filter((c) => !recIds.has(c.id)).map((c) => ({ cmd: c, group: c.category as string }))
      ]
    }
    return commands
      .map((c) => ({
        cmd: c,
        score: Math.max(fuzzyScore(query, c.title), fuzzyScore(query, `${c.category} ${c.keywords ?? ''}`) * 0.6)
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((r) => ({ cmd: r.cmd, group: 'Results' }))
  }, [query, commands, recent])

  useEffect(() => setIndex(0), [query])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const execute = (cmd: Command): void => {
    setOpen(false)
    void Promise.resolve(cmd.run()).catch((err: Error) =>
      toast({ tone: 'danger', title: 'Command failed', description: err.message })
    )
    const nextRecent = [cmd.id, ...recent.filter((r) => r !== cmd.id)].slice(0, 10)
    void update({ commandPalette: { recent: nextRecent } }).catch(() => undefined)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[index]
      if (r) execute(r.cmd)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  let lastGroup = ''

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 600, damping: 40 }}
            className="panel w-full max-w-[620px] overflow-hidden bg-surface shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-4 w-4 text-faint" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type a command or search…"
                className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div ref={listRef} className="max-h-[380px] overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <div className="px-4 py-10 text-center text-[13px] text-muted">No commands match “{query}”.</div>
              ) : (
                results.map((r, i) => {
                  const header = r.group !== lastGroup ? r.group : null
                  lastGroup = r.group
                  const hl = fuzzyHighlights(query, r.cmd.title)
                  return (
                    <div key={`${r.group}-${r.cmd.id}`}>
                      {header && (
                        <div className="px-2.5 pt-2.5 pb-1 text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
                          {header}
                        </div>
                      )}
                      <button
                        data-index={i}
                        onMouseMove={() => setIndex(i)}
                        onClick={() => execute(r.cmd)}
                        className={cx(
                          'flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[13px]',
                          i === index ? 'bg-accent-soft text-fg' : 'text-muted'
                        )}
                      >
                        <span className={cx('[&_svg]:h-4 [&_svg]:w-4', i === index ? 'text-accent' : 'text-faint')}>
                          {r.cmd.icon}
                        </span>
                        <span className="flex-1 truncate">
                          {[...r.cmd.title].map((ch, ci) => (
                            <span key={ci} className={hl.has(ci) ? 'font-semibold text-fg' : undefined}>
                              {ch}
                            </span>
                          ))}
                        </span>
                        {r.cmd.hint && <span className="text-[11px] text-faint">{r.cmd.hint}</span>}
                        {i === index && <CornerDownLeft className="h-3.5 w-3.5 text-faint" />}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            <div className="flex items-center gap-4 border-t border-border bg-surface-2/60 px-4 py-2 text-[11px] text-faint">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd> run
              </span>
              <span className="ml-auto flex items-center gap-1">
                {results.length} {results.length === 1 ? 'command' : 'commands'} <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
