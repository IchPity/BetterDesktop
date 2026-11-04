import os from 'node:os'
import type { KillResult, ProcessInfo, ProcessListResult } from '@shared/system'
import type { MetricsProvider } from './providers'

/** Windows processes that must never be terminated from the UI. */
const PROTECTED_NAMES = new Set([
  'system',
  'system idle process',
  'idle',
  'registry',
  'secure system',
  'memory compression',
  'smss',
  'csrss',
  'wininit',
  'winlogon',
  'services',
  'lsass',
  'lsaiso',
  'svchost',
  'dwm',
  'fontdrvhost'
])

export function isProtectedProcess(name: string): boolean {
  return PROTECTED_NAMES.has(name.toLowerCase().replace(/\.exe$/, ''))
}

/**
 * Process list with CPU% derived from cumulative CPU time deltas between two
 * samples (Windows). If the previous sample is missing or stale, a second
 * sample is taken shortly after the first so percentages are always real.
 */
export class ProcessService {
  private prev: { at: number; cpu: Map<number, number> } | null = null
  private inflight: Promise<ProcessListResult> | null = null

  constructor(private readonly provider: MetricsProvider) {}

  list(): Promise<ProcessListResult> {
    if (!this.inflight) {
      this.inflight = this.load().finally(() => {
        this.inflight = null
      })
    }
    return this.inflight
  }

  private async load(): Promise<ProcessListResult> {
    let res = await this.provider.processes()
    if (res.cpuIsCumulative && (!this.prev || Date.now() - this.prev.at > 15_000)) {
      this.remember(res.list)
      await new Promise((r) => setTimeout(r, 800))
      res = await this.provider.processes()
    }
    const now = Date.now()
    const totalMem = os.totalmem()
    const cores = os.cpus().length || 1
    const prev = this.prev
    const processes: ProcessInfo[] = res.list
      .filter((p) => p.pid > 0)
      .map((p) => {
        let cpu = p.cpu
        if (res.cpuIsCumulative) {
          const before = prev?.cpu.get(p.pid)
          const dt = prev ? now - prev.at : 0
          cpu = before !== undefined && dt > 0 ? ((p.cpu - before) / dt / cores) * 100 : 0
        }
        return {
          pid: p.pid,
          name: p.name,
          cpu: Math.max(0, Math.min(100, Math.round(cpu * 10) / 10)),
          memRss: p.ws,
          memPercent: Math.round((p.ws / totalMem) * 1000) / 10,
          path: p.path,
          started: p.start,
          protected: isProtectedProcess(p.name)
        }
      })
    if (res.cpuIsCumulative) this.remember(res.list)
    return { processes, total: processes.length, timestamp: now }
  }

  private remember(list: Array<{ pid: number; cpu: number }>): void {
    this.prev = { at: Date.now(), cpu: new Map(list.map((p) => [p.pid, p.cpu])) }
  }

  async kill(pid: number, expectedName: string): Promise<KillResult> {
    if (pid <= 4) return { ok: false, error: 'System processes cannot be terminated.' }
    if (pid === process.pid || pid === process.ppid) {
      return { ok: false, error: 'BetterDesktop cannot terminate itself.' }
    }
    // Re-check right before killing so a recycled PID can never hit a
    // different process than the one the user confirmed.
    const { list } = await this.provider.processes()
    const target = list.find((p) => p.pid === pid)
    if (!target) return { ok: false, error: 'The process is no longer running.' }
    if (target.name.toLowerCase() !== expectedName.toLowerCase()) {
      return { ok: false, error: 'This PID now belongs to a different process. Refresh and try again.' }
    }
    if (isProtectedProcess(target.name)) {
      return { ok: false, error: `${target.name} is a protected Windows process.` }
    }
    try {
      process.kill(pid)
      return { ok: true }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'EPERM') {
        return { ok: false, error: 'Access denied – terminating this process requires administrator rights.' }
      }
      if (code === 'ESRCH') return { ok: false, error: 'The process is no longer running.' }
      return { ok: false, error: (err as Error).message }
    }
  }
}
