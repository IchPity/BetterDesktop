import os from 'node:os'
import type { DiskIoLive, DiskLive, GpuLive, NetworkLive, SystemSnapshot, SystemStatic } from '@shared/system'
import { createProvider, type MetricsProvider, type NetCounters } from './providers'

function round(v: number, digits = 1): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

const EMPTY_NET: NetworkLive = {
  iface: null,
  ifaceName: null,
  type: null,
  ip4: null,
  mac: null,
  operstate: null,
  speedMbit: null,
  rxPerSec: null,
  txPerSec: null,
  rxTotal: null,
  txTotal: null
}

/**
 * Collects real system metrics.
 *
 * The live tick only uses instant Node APIs (os.cpus / os.totalmem /
 * os.freemem) and never spawns processes. Everything else comes from the
 * platform provider and runs in the background, feeding caches:
 *   sample (network, GPU, disk I/O) – every tick, one request at a time
 *   swap                            – every 10s
 *   drives                          – every 30s
 *
 * On Windows the provider talks to ONE persistent PowerShell helper that reads
 * .NET performance counters (see win-helper.ps1). Nothing runs while no window
 * is subscribed.
 */
export class SystemMonitor {
  readonly provider: MetricsProvider = createProvider()
  private staticInfo: Promise<SystemStatic> | null = null

  private timer: NodeJS.Timeout | null = null
  private intervalMs: number
  private running = false
  private paused = false
  private listeners = new Set<(s: SystemSnapshot) => void>()

  private prevCpuTimes: Array<{ idle: number; total: number }> | null = null

  private sampleBusy = false
  private net: NetworkLive = EMPTY_NET
  private prevNet: { at: number; rx: number; tx: number; iface: string | null } | null = null
  private gpu: GpuLive | null = null
  private diskIo: DiskIoLive | null = null
  private sampleFailed = false

  private drives: DiskLive[] | null = null
  private drivesAt = 0
  private swap: { total: number; used: number } | null = null
  private swapAt = 0

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs
    this.cpuLoad() // prime CPU counters so the first sample is meaningful
  }

  getStatic(): Promise<SystemStatic> {
    if (!this.staticInfo) {
      this.staticInfo = this.provider.static().catch((err) => {
        this.staticInfo = null
        throw err
      })
    }
    return this.staticInfo
  }

  subscribe(fn: (s: SystemSnapshot) => void): () => void {
    this.listeners.add(fn)
    this.ensureRunning()
    return () => {
      this.listeners.delete(fn)
      if (this.listeners.size === 0) this.halt()
    }
  }

  setIntervalMs(ms: number): void {
    if (ms === this.intervalMs) return
    this.intervalMs = ms
    if (this.running) {
      this.halt()
      this.ensureRunning()
    }
  }

  /** Stop polling (e.g. window minimized) without dropping subscribers. */
  pause(): void {
    this.paused = true
    this.halt()
  }

  resume(): void {
    this.paused = false
    this.ensureRunning()
  }

  dispose(): void {
    this.listeners.clear()
    this.halt()
    this.provider.dispose()
  }

  private ensureRunning(): void {
    if (this.running || this.paused || this.listeners.size === 0) return
    this.running = true
    this.tick()
  }

  private halt(): void {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private tick(): void {
    if (!this.running) return
    try {
      this.refreshBackground()
      const snapshot = this.collect()
      for (const fn of this.listeners) fn(snapshot)
    } catch (err) {
      console.error('[monitor] collect failed', err)
    }
    this.timer = setTimeout(() => this.tick(), this.intervalMs)
  }

  /** CPU load from os.cpus() time deltas – instant and process-free. */
  private cpuLoad(): { total: number; cores: number[] } {
    const times = os.cpus().map((c) => {
      const t = c.times
      return { idle: t.idle, total: t.user + t.nice + t.sys + t.idle + t.irq }
    })
    const prev = this.prevCpuTimes
    this.prevCpuTimes = times
    if (!prev || prev.length !== times.length) return { total: 0, cores: times.map(() => 0) }
    let idleSum = 0
    let totalSum = 0
    const pct = (idle: number, total: number): number =>
      total > 0 ? round(Math.max(0, Math.min(100, (1 - idle / total) * 100))) : 0
    const cores = times.map((t, i) => {
      const idle = t.idle - prev[i].idle
      const total = t.total - prev[i].total
      idleSum += idle
      totalSum += total
      return pct(idle, total)
    })
    return { total: pct(idleSum, totalSum), cores }
  }

  private collect(): SystemSnapshot {
    const load = this.cpuLoad()
    const total = os.totalmem()
    const free = os.freemem()
    const speedMHz = os.cpus()[0]?.speed ?? 0
    return {
      timestamp: Date.now(),
      cpu: {
        load: load.total,
        cores: load.cores,
        // Node reports the nominal clock on Windows; live boost clocks need a driver.
        speedGHz: speedMHz > 0 ? round(speedMHz / 1000, 2) : null,
        // CPU temperature is not exposed to non-admin apps on Windows.
        temperatureC: null
      },
      mem: {
        total,
        used: total - free,
        available: free,
        swapTotal: this.swap?.total ?? 0,
        swapUsed: this.swap?.used ?? 0
      },
      gpu: this.sampleFailed ? { load: null, dedicatedUsed: null, adapters: [] } : this.gpu,
      network: this.net,
      disks: this.drives,
      diskIo: this.diskIo
    }
  }

  private refreshBackground(): void {
    const now = Date.now()
    if (!this.sampleBusy) {
      this.sampleBusy = true
      this.provider
        .sample()
        .then((s) => {
          this.sampleFailed = false
          this.gpu = s.gpu
          this.diskIo = s.diskIo
          this.net = this.withRates(s.network)
        })
        .catch((err: Error) => {
          this.sampleFailed = true
          console.warn('[monitor] sample failed:', err.message)
        })
        .finally(() => {
          this.sampleBusy = false
        })
    }
    if (now - this.drivesAt > 30_000) {
      this.drivesAt = now
      this.provider
        .drives()
        .then((d) => (this.drives = d))
        .catch(() => (this.drives = this.drives ?? []))
    }
    if (now - this.swapAt > 10_000) {
      this.swapAt = now
      this.provider
        .swap()
        .then((s) => (this.swap = s))
        .catch(() => undefined)
    }
  }

  private withRates(c: NetCounters | null): NetworkLive {
    if (!c) return { ...EMPTY_NET, operstate: 'down' }
    const now = Date.now()
    let rxPerSec: number | null = null
    let txPerSec: number | null = null
    const p = this.prevNet
    if (p && p.iface === c.iface && c.rxTotal !== null && c.txTotal !== null) {
      const dt = (now - p.at) / 1000
      if (dt > 0.2) {
        rxPerSec = Math.max(0, (c.rxTotal - p.rx) / dt)
        txPerSec = Math.max(0, (c.txTotal - p.tx) / dt)
      } else {
        rxPerSec = this.net.rxPerSec
        txPerSec = this.net.txPerSec
      }
    }
    if (c.rxTotal !== null && c.txTotal !== null && (!p || (now - p.at) / 1000 > 0.2 || p.iface !== c.iface)) {
      this.prevNet = { at: now, rx: c.rxTotal, tx: c.txTotal, iface: c.iface }
    }
    return { ...c, rxPerSec, txPerSec }
  }
}
