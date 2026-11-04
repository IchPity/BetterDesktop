import { app, type WebContents } from 'electron'
import { z } from 'zod'
import { IPC } from '@shared/ipc'
import type { AppInfo } from '@shared/app'
import { settingsSchema } from '@shared/settings'
import type { SettingsStore } from '../services/settings-store'
import { SystemMonitor } from '../services/system/monitor'
import { killProcess, listProcesses } from '../services/system/processes'
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

  // ---- settings ----------------------------------------------------------
  handle(IPC.settingsGet, none, () => store.get())
  handle(IPC.settingsUpdate, settingsPatchSchema, (patch) => store.update(patch))
  handle(IPC.settingsReset, none, () => store.reset())

  // ---- system monitoring -------------------------------------------------
  handle(IPC.systemStatic, none, () => SystemMonitor.getStatic())

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
  handle(IPC.processesList, none, () => listProcesses())
  handle(
    IPC.processKill,
    z.object({ pid: z.number().int().positive().max(2 ** 31), name: z.string().min(1).max(260) }).strict(),
    ({ pid, name }) => killProcess(pid, name)
  )
}
