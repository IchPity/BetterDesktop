import si from 'systeminformation'
import type { KillResult, ProcessListResult } from '@shared/system'

/** Windows processes that must never be terminated from the UI. */
const PROTECTED_NAMES = new Set([
  'system',
  'system idle process',
  'idle',
  'registry',
  'secure system',
  'memory compression',
  'smss.exe',
  'csrss.exe',
  'wininit.exe',
  'winlogon.exe',
  'services.exe',
  'lsass.exe',
  'lsaiso.exe',
  'svchost.exe',
  'dwm.exe',
  'fontdrvhost.exe'
])

let inflight: Promise<ProcessListResult> | null = null

export function listProcesses(): Promise<ProcessListResult> {
  // Process enumeration is expensive on Windows; collapse concurrent calls.
  if (!inflight) {
    inflight = si
      .processes()
      .then((p) => ({
        total: p.all,
        running: p.running,
        timestamp: Date.now(),
        processes: p.list
          .filter((x) => x.pid > 0)
          .map((x) => ({
            pid: x.pid,
            parentPid: x.parentPid,
            name: x.name,
            cpu: Math.max(0, Math.round(x.cpu * 10) / 10),
            // systeminformation reports memRss in KB
            memRss: Math.max(0, x.memRss) * 1024,
            memPercent: Math.max(0, Math.round(x.mem * 10) / 10),
            user: x.user || null,
            path: x.path || null,
            started: x.started || null
          }))
      }))
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function isProtectedProcess(name: string): boolean {
  return PROTECTED_NAMES.has(name.toLowerCase())
}

export async function killProcess(pid: number, expectedName: string): Promise<KillResult> {
  if (pid <= 4) return { ok: false, error: 'System processes cannot be terminated.' }
  if (pid === process.pid || pid === process.ppid) {
    return { ok: false, error: 'BetterDesktop cannot terminate itself.' }
  }

  // Re-check the target right before killing it so a recycled PID can never
  // hit a different process than the one the user confirmed.
  const { processes } = await listProcesses()
  const target = processes.find((p) => p.pid === pid)
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
