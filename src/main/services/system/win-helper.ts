import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import script from './win-helper.ps1?raw'

export type HelperCommand = 'sample' | 'drives' | 'page' | 'static' | 'procs'

export interface HelperNet {
  name: string
  desc: string
  type: string
  up: boolean
  rx: number
  tx: number
  speed: number
  mac: string
  ip: string | null
  gateway: boolean
}
export interface HelperGpu {
  luid: string
  util: number | null
  dedicated: number | null
}
export interface HelperSample {
  net: HelperNet[]
  gpu: HelperGpu[] | null
  disk: { read: number; write: number; busy: number } | null
}
export interface HelperDrive {
  mount: string
  fs: string
  type: string
  label: string
  size: number
  free: number
}
export interface HelperStatic {
  os: { caption: string; version: string; build: string }
  cpu: { name: string; manufacturer: string; cores: number; threads: number; maxMHz: number }
  gpus: Array<{ model: string; vendor: string; vram: number | null }>
}
export interface HelperProc {
  pid: number
  name: string
  cpu: number
  ws: number
  path: string | null
  start: string | null
}

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: NodeJS.Timeout
}

/**
 * Owns a single persistent PowerShell process running win-helper.ps1.
 * Started lazily on first request and shut down after a period of inactivity,
 * so BetterDesktop keeps no helper alive while nothing is being monitored.
 */
export class WinHelper {
  private proc: ChildProcessWithoutNullStreams | null = null
  private ready: Promise<void> | null = null
  private pending = new Map<number, Pending>()
  private nextId = 1
  private idleTimer: NodeJS.Timeout | null = null
  private failures = 0

  constructor(private readonly idleMs = 30_000) {}

  get available(): boolean {
    return process.platform === 'win32' && this.failures < 5
  }

  async request<T>(cmd: HelperCommand, timeoutMs = 15_000): Promise<T> {
    if (!this.available) throw new Error('Windows helper unavailable')
    await this.start()
    this.touch()
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Helper command "${cmd}" timed out`))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      this.proc!.stdin.write(`${id} ${cmd}\n`)
    })
  }

  dispose(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
    const p = this.proc
    this.proc = null
    this.ready = null
    if (p && !p.killed) {
      try {
        p.stdin.write('0 exit\n')
      } catch {
        /* ignore */
      }
      setTimeout(() => !p.killed && p.kill(), 500).unref()
    }
    this.rejectAll(new Error('Helper stopped'))
  }

  private touch(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => {
      if (this.pending.size === 0) this.dispose()
      else this.touch()
    }, this.idleMs)
    this.idleTimer.unref()
  }

  private start(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = new Promise<void>((resolve, reject) => {
      // The script is passed as UTF-16LE base64 so no quoting/escaping issues.
      const encoded = Buffer.from(script, 'utf16le').toString('base64')
      const proc = spawn(
        'powershell.exe',
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
        { windowsHide: true, stdio: 'pipe' }
      )
      this.proc = proc
      let started = false
      const startTimer = setTimeout(() => {
        if (!started) {
          this.failures++
          reject(new Error('Helper did not start in time'))
          proc.kill()
        }
      }, 20_000)

      const rl = createInterface({ input: proc.stdout })
      rl.on('line', (line) => {
        if (!started) {
          if (line.trim() === 'ready') {
            started = true
            clearTimeout(startTimer)
            resolve()
          }
          return
        }
        const sp = line.indexOf(' ')
        if (sp < 0) return
        const id = Number(line.slice(0, sp))
        const p = this.pending.get(id)
        if (!p) return
        this.pending.delete(id)
        clearTimeout(p.timer)
        try {
          const data = JSON.parse(line.slice(sp + 1)) as unknown
          if (data && typeof data === 'object' && 'error' in data && Object.keys(data).length === 1) {
            p.reject(new Error(String((data as { error: unknown }).error)))
          } else {
            p.resolve(data)
          }
        } catch (err) {
          p.reject(err as Error)
        }
      })
      proc.stderr.on('data', () => undefined)
      proc.on('error', (err) => {
        this.failures++
        clearTimeout(startTimer)
        reject(err)
      })
      proc.on('exit', () => {
        clearTimeout(startTimer)
        if (this.proc === proc) {
          this.proc = null
          this.ready = null
        }
        if (!started) {
          this.failures++
          reject(new Error('Helper exited during startup'))
        }
        this.rejectAll(new Error('Helper exited'))
      })
    }).catch((err) => {
      this.ready = null
      throw err
    })
    return this.ready
  }

  private rejectAll(err: Error): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      p.reject(err)
    }
    this.pending.clear()
  }
}

/** Shared instance for the whole main process. */
export const winHelper = new WinHelper()
