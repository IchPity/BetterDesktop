import { app, shell, type WebContents } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/ipc'
import { SYSTEM_TOOLS, type AppInfo, type SystemTool } from '@shared/app'
import { launchTool } from '../services/tools'
import { settingsSchema } from '@shared/settings'
import type { SettingsStore } from '../services/settings-store'
import { SystemMonitor } from '../services/system/monitor'
import { ProcessService } from '../services/system/processes'
import { handle } from './validate'

const none = z.undefined()

// Every section of the settings may be patched partially; values are fully
// re-validated by the store after merging.
const settingsPatchSchema = z
  .object({
    appearance: settingsSchema.shape.appearance.partial(),
    monitoring: settingsSchema.shape.monitoring.partial(),
    startup: settingsSchema.shape.startup.partial(),
    notifications: settingsSchema.shape.notifications.partial(),
    dashboard: settingsSchema.shape.dashboard.partial(),
    commandPalette: settingsSchema.shape.commandPalette.partial()
  })
  .partial()
  .strict()

export function registerIpc(store: SettingsStore, monitor: SystemMonitor): void {
  handle(IPC.appInfo, none, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    userDataPath: app.getPath('userData')
  }))

  handle(IPC.appOpenDataFolder, none, async () => {
    const error = await shell.openPath(app.getPath('userData'))
    return error ? { ok: false, error } : { ok: true }
  })

  handle(
    IPC.launchTool,
    z.enum(Object.keys(SYSTEM_TOOLS) as [SystemTool, ...SystemTool[]]),
    (tool) => launchTool(tool)
  )

  // ---- settings ----------------------------------------------------------
  handle(IPC.settingsGet, none, () => store.get())
  handle(IPC.settingsUpdate, settingsPatchSchema, (patch) => store.update(patch))
  handle(IPC.settingsReset, none, () => store.reset())

  // ---- system monitoring -------------------------------------------------
  handle(IPC.systemStatic, none, () => monitor.getStatic())

  const subscriptions = new Map<number, () => void>()
  const unsubscribe = (wc: WebContents): void => {
    subscriptions.get(wc.id)?.()
    subscriptions.delete(wc.id)
  }

  handle(IPC.systemStart, none, (_p, event) => {
    const wc = event.sender
    if (subscriptions.has(wc.id)) return
    const off = monitor.subscribe((snapshot) => {
      if (!wc.isDestroyed()) wc.send(IPC.systemUpdate, snapshot)
    })
    subscriptions.set(wc.id, off)
    wc.once('destroyed', () => unsubscribe(wc))
  })

  handle(IPC.systemStop, none, (_p, event) => unsubscribe(event.sender))

  // ---- processes ---------------------------------------------------------
  const processes = new ProcessService(monitor.provider)
  handle(IPC.processesList, none, () => processes.list())
  handle(
    IPC.processKill,
    z.object({ pid: z.number().int().positive().max(2 ** 31), name: z.string().min(1).max(260) }).strict(),
    ({ pid, name }) => processes.kill(pid, name)
  )
}
