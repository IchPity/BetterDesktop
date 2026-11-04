import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useEffect } from 'react'
import { ACCENTS } from '@shared/settings'
import { Sidebar } from '@/components/layout/Sidebar'
import { TitleBar, Logo } from '@/components/layout/TitleBar'
import { Toaster } from '@/components/layout/Toaster'
import { CommandPalette } from '@/components/CommandPalette'
import { Button } from '@/components/ui/Button'
import { MODULES, MODULE_MAP, type ModuleId } from '@/modules/registry'
import { Overview } from '@/modules/overview/Overview'
import { PcControlCenter } from '@/modules/pc/PcControlCenter'
import { NetworkMonitor } from '@/modules/network/NetworkMonitor'
import { SettingsPage } from '@/modules/settings/SettingsPage'
import { PlannedModule } from '@/modules/planned/PlannedModule'
import { useSettings } from '@/stores/settings'
import { startSystemStream, useSystem } from '@/stores/system'
import { useUi } from '@/stores/ui'

const PAGES: Partial<Record<ModuleId, () => React.JSX.Element>> = {
  overview: Overview,
  pc: PcControlCenter,
  network: NetworkMonitor,
  settings: SettingsPage
}

export function App(): React.JSX.Element {
  const settings = useSettings((s) => s.settings)
  const error = useSettings((s) => s.error)
  const load = useSettings((s) => s.load)

  useEffect(() => {
    void load()
    startSystemStream()
  }, [load])

  useThemeSync()
  useGlobalShortcuts()

  if (!settings) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Logo size={40} />
        {error ? (
          <>
            <div className="text-[13px] text-danger">Could not load settings: {error}</div>
            <Button onClick={() => void load()}>Retry</Button>
          </>
        ) : (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-r-transparent" />
        )}
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion={settings.appearance.reduceMotion ? 'always' : 'never'}>
      <div className="flex h-full flex-col">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="relative min-w-0 flex-1 overflow-y-auto">
            <ModuleView />
          </main>
        </div>
      </div>
      <CommandPalette />
      <Toaster />
    </MotionConfig>
  )
}

function ModuleView(): React.JSX.Element {
  const id = useUi((s) => s.module)
  const Page = PAGES[id]
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        {Page ? <Page /> : <PlannedModule module={MODULE_MAP[id]} />}
      </motion.div>
    </AnimatePresence>
  )
}

/** Applies theme, accent and motion settings to the document. */
function useThemeSync(): void {
  const appearance = useSettings((s) => s.settings?.appearance)
  const historyLength = useSettings((s) => s.settings?.monitoring.historyLength)

  useEffect(() => {
    if (!appearance) return
    const root = document.documentElement
    const apply = (): void => {
      const dark =
        appearance.theme === 'dark' ||
        (appearance.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    root.style.setProperty('--accent', ACCENTS[appearance.accent])
    root.dataset.reduceMotion = String(appearance.reduceMotion)
    if (appearance.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [appearance])

  useEffect(() => {
    if (historyLength) useSystem.getState().setHistoryLength(historyLength)
  }, [historyLength])
}

/** In-app shortcuts: Ctrl+K palette, Ctrl+B sidebar, Ctrl+1..9 / Ctrl+, modules. */
function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return
      const ui = useUi.getState()
      const key = e.key.toLowerCase()
      if (key === 'k') {
        e.preventDefault()
        ui.setPaletteOpen(!ui.paletteOpen)
        return
      }
      if (key === 'b') {
        e.preventDefault()
        const s = useSettings.getState()
        if (s.settings) void s.update({ appearance: { sidebarCollapsed: !s.settings.appearance.sidebarCollapsed } })
        return
      }
      const target = MODULES.find((m) => m.shortcut === e.key)
      if (target) {
        e.preventDefault()
        ui.navigate(target.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
