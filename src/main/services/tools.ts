import { shell } from 'electron'
import { spawn } from 'node:child_process'
import type { SystemTool } from '@shared/app'

type Launch = { kind: 'exe'; file: string; args?: string[] } | { kind: 'uri'; uri: string }

/** Whitelisted launch targets – the renderer can only pick a key. */
const WINDOWS_TOOLS: Record<SystemTool, Launch> = {
  taskmgr: { kind: 'exe', file: 'taskmgr.exe' },
  explorer: { kind: 'exe', file: 'explorer.exe', args: ['shell:MyComputerFolder'] },
  control: { kind: 'exe', file: 'control.exe' },
  'settings-display': { kind: 'uri', uri: 'ms-settings:display' },
  'settings-sound': { kind: 'uri', uri: 'ms-settings:sound' },
  'settings-network': { kind: 'uri', uri: 'ms-settings:network-status' },
  'settings-storage': { kind: 'uri', uri: 'ms-settings:storagesense' }
}

export async function launchTool(tool: SystemTool): Promise<{ ok: boolean; error?: string }> {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'This shortcut is currently only available on Windows.' }
  }
  const target = WINDOWS_TOOLS[tool]
  try {
    if (target.kind === 'uri') {
      await shell.openExternal(target.uri)
    } else {
      const child = spawn(target.file, target.args ?? [], { detached: true, stdio: 'ignore', shell: false })
      child.on('error', () => undefined)
      child.unref()
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
