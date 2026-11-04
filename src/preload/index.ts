import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc'
import type { AppInfo, SystemTool } from '@shared/app'

type ActionResult = { ok: boolean; error?: string }
import type { Settings, SettingsPatch } from '@shared/settings'
import type { KillResult, ProcessListResult, SystemSnapshot, SystemStatic } from '@shared/system'
import type { PetCommand, PetStatus } from '@shared/pet'

/**
 * The ONLY surface the renderer can use to reach the system.
 * Every function maps to one validated IPC handler in the main process –
 * no generic "invoke anything" escape hatch is exposed.
 */
const api = {
  app: {
    info: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.appInfo),
    openDataFolder: (): Promise<ActionResult> => ipcRenderer.invoke(IPC.appOpenDataFolder),
    launchTool: (tool: SystemTool): Promise<ActionResult> => ipcRenderer.invoke(IPC.launchTool, tool),
    platform: process.platform,
    /** The main process asks the UI to open a module (e.g. "Pet settings…"). */
    onNavigate: (fn: (module: string) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, m: unknown): void => {
        if (typeof m === 'string') fn(m)
      }
      ipcRenderer.on(IPC.appNavigate, listener)
      return () => ipcRenderer.removeListener(IPC.appNavigate, listener)
    }
  },
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke(IPC.settingsGet),
    update: (patch: SettingsPatch): Promise<Settings> => ipcRenderer.invoke(IPC.settingsUpdate, patch),
    reset: (): Promise<Settings> => ipcRenderer.invoke(IPC.settingsReset),
    onChange: (fn: (s: Settings) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, s: Settings): void => fn(s)
      ipcRenderer.on(IPC.settingsChanged, listener)
      return () => ipcRenderer.removeListener(IPC.settingsChanged, listener)
    }
  },
  system: {
    static: (): Promise<SystemStatic> => ipcRenderer.invoke(IPC.systemStatic),
    start: (): Promise<void> => ipcRenderer.invoke(IPC.systemStart),
    stop: (): Promise<void> => ipcRenderer.invoke(IPC.systemStop),
    onUpdate: (fn: (s: SystemSnapshot) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, s: SystemSnapshot): void => fn(s)
      ipcRenderer.on(IPC.systemUpdate, listener)
      return () => ipcRenderer.removeListener(IPC.systemUpdate, listener)
    }
  },
  processes: {
    list: (): Promise<ProcessListResult> => ipcRenderer.invoke(IPC.processesList),
    kill: (pid: number, name: string): Promise<KillResult> => ipcRenderer.invoke(IPC.processKill, { pid, name })
  },
  pet: {
    status: (): Promise<PetStatus> => ipcRenderer.invoke(IPC.petStatus),
    command: (cmd: PetCommand): Promise<void> => ipcRenderer.invoke(IPC.petCommand, cmd),
    onStatus: (fn: (s: PetStatus) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, s: PetStatus): void => fn(s)
      ipcRenderer.on(IPC.petStatusChanged, listener)
      return () => ipcRenderer.removeListener(IPC.petStatusChanged, listener)
    }
  }
}

export type BetterDesktopApi = typeof api

contextBridge.exposeInMainWorld('bd', api)
