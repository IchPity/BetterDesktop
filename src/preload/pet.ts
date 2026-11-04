import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '@shared/ipc'
import type { PetView } from '@shared/pet'

/**
 * Minimal API for the Desktop Pet window. It can only report its own
 * interactions – no settings, processes or system tools. The main process
 * additionally rejects these channels from any other window.
 */
const api = {
  view: (): Promise<PetView> => ipcRenderer.invoke(IPC.petViewGet),
  onView: (fn: (v: PetView) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, v: PetView): void => fn(v)
    ipcRenderer.on(IPC.petViewChanged, listener)
    return () => ipcRenderer.removeListener(IPC.petViewChanged, listener)
  },
  setInteractive: (on: boolean): Promise<void> => ipcRenderer.invoke(IPC.petInteractive, on),
  dragStart: (): Promise<void> => ipcRenderer.invoke(IPC.petDragStart),
  dragEnd: (): Promise<void> => ipcRenderer.invoke(IPC.petDragEnd),
  poke: (): Promise<void> => ipcRenderer.invoke(IPC.petPoke),
  menu: (): Promise<void> => ipcRenderer.invoke(IPC.petMenu),
  openApp: (): Promise<void> => ipcRenderer.invoke(IPC.petOpenApp),
  dismissBubble: (): Promise<void> => ipcRenderer.invoke(IPC.petDismissBubble)
}

export type PetApi = typeof api

contextBridge.exposeInMainWorld('pet', api)
