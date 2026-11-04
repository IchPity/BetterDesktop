import si from 'systeminformation'
import type {
  DiskIoLive,
  DiskLive,
  GpuLive,
  NetworkLive,
  SystemSnapshot,
  SystemStatic
} from '@shared/system'

/** Converts "unknown" values from systeminformation (-1, NaN, undefined) to null. */
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
}

function round(v: number, digits = 1): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

type NetBase = Pick<NetworkLive, 'iface' | 'ifaceName' | 'type' | 'ip4' | 'mac' | 'speedMbit'>

/**
 * Collects real system metrics. Expensive probes run on slower tiers so the
 * fast tick (CPU / RAM / network) stays cheap:
 *   fast   – every tick            (currentLoad, mem, networkStats, speed)
 *   medium – every ~5s             (GPU via WMI / nvidia-smi)
 *   slow   – every ~30s            (filesystem sizes, default interface)
 *   temp   – probed once on Windows (needs admin/WMI on most machines)
 */
export class SystemMonitor {
  private static staticInfo: Promise<SystemStatic> | null = null

  private timer: NodeJS.Timeout | null = null
  private intervalMs: number
  private running = false
  private paused = false
  private busy = false
  private listeners = new Set<(s: SystemSnapshot) => void>()

  private gpuCache: GpuLive[] | null = null
  private gpuAt = 0
  private diskCache: DiskLive[] | null = null
  private diskAt = 0
  private tempCache: number | null = null
  private tempAt = 0
  private tempSupported = true
  private netBase: NetBase | null = null
  private netBaseAt = 0
  private diskIoSupported = process.platform !== 'win32'

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs
  }

  static getStatic(): Promise<SystemStatic> {
    if (!this.staticInfo) {
      this.staticInfo = (async (): Promise<SystemStatic> => {
        const [cpu, mem, os, graphics] = await Promise.all([
          si.cpu(),
          si.mem(),
          si.osInfo(),
          si.graphics().catch(() => null)
        ])
        return {
          cpu: {
            manufacturer: cpu.manufacturer,
            brand: cpu.brand,
            physicalCores: cpu.physicalCores,
            logicalCores: cpu.cores,
            baseSpeedGHz: num(cpu.speed),
            maxSpeedGHz: num(cpu.speedMax)
          },
          gpus: (graphics?.controllers ?? []).map((c) => ({
            model: c.model || 'Unknown GPU',
            vendor: c.vendor || '',
            vramMB: num(c.vram)
          })),
          memTotal: mem.total,
          os: {
            platform: os.platform,
            distro: os.distro,
            release: os.release,
            arch: os.arch,
            hostname: os.hostname
          }
        }
      })().catch((err) => {
        SystemMonitor.staticInfo = null
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
  }

  private ensureRunning(): void {
    if (this.running || this.paused || this.listeners.size === 0) return
    this.running = true
    void this.tick()
  }

  private halt(): void {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private async tick(): Promise<void> {
    if (!this.running || this.busy) return
    this.busy = true
    const started = Date.now()
    try {
      const snapshot = await this.collect()
      if (this.running) for (const fn of this.listeners) fn(snapshot)
    } catch (err) {
      console.error('[monitor] collect failed', err)
    } finally {
      this.busy = false
      if (this.running) {
        const elapsed = Date.now() - started
        this.timer = setTimeout(() => void this.tick(), Math.max(250, this.intervalMs - elapsed))
      }
    }
  }

  private async collect(): Promise<SystemSnapshot> {
    const now = Date.now()

    // Slower tiers refresh their caches in the background.
    if (now - this.gpuAt > 5_000) {
      this.gpuAt = now
      void this.collectGpu()
    }
    if (now - this.diskAt > 30_000) {
      this.diskAt = now
      void this.collectDisks()
    }
    if (this.tempSupported && now - this.tempAt > 5_000) {
      this.tempAt = now
      void this.collectTemperature()
    }

    const [load, mem, speed, network, diskIo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.cpuCurrentSpeed().catch(() => null),
      this.collectNetwork(now),
      this.collectDiskIo()
    ])

    return {
      timestamp: now,
      cpu: {
        load: round(load.currentLoad),
        cores: load.cpus.map((c) => round(c.load)),
        speedGHz: speed ? num(speed.avg) : null,
        temperatureC: this.tempCache
      },
      mem: {
        total: mem.total,
        used: mem.active,
        available: mem.available,
        swapTotal: mem.swaptotal,
        swapUsed: mem.swapused
      },
      gpus: this.gpuCache,
      network,
      disks: this.diskCache,
      diskIo
    }
  }

  private async collectNetwork(now: number): Promise<NetworkLive> {
    if (!this.netBase || now - this.netBaseAt > 30_000) {
      this.netBaseAt = now
      try {
        const name = await si.networkInterfaceDefault()
        const ifaces = await si.networkInterfaces()
        const list = Array.isArray(ifaces) ? ifaces : [ifaces]
        const iface = list.find((i) => i.iface === name) ?? list.find((i) => i.default) ?? null
        this.netBase = {
          iface: iface?.iface ?? (name || null),
          ifaceName: iface?.ifaceName || null,
          type: iface?.type || null,
          ip4: iface?.ip4 || null,
          mac: iface?.mac || null,
          speedMbit: num(iface?.speed)
        }
      } catch {
        this.netBase = { iface: null, ifaceName: null, type: null, ip4: null, mac: null, speedMbit: null }
      }
    }
    const base = this.netBase
    try {
      const stats = await si.networkStats(base.iface ?? undefined)
      const s = stats[0]
      return {
        ...base,
        operstate: s?.operstate ?? null,
        rxPerSec: num(s?.rx_sec),
        txPerSec: num(s?.tx_sec),
        rxTotal: num(s?.rx_bytes),
        txTotal: num(s?.tx_bytes)
      }
    } catch {
      return { ...base, operstate: null, rxPerSec: null, txPerSec: null, rxTotal: null, txTotal: null }
    }
  }

  private async collectGpu(): Promise<void> {
    try {
      const g = await si.graphics()
      this.gpuCache = g.controllers.map((c) => ({
        model: c.model || 'Unknown GPU',
        utilization: num(c.utilizationGpu),
        temperatureC: num(c.temperatureGpu),
        vramUsedMB: num(c.memoryUsed),
        vramTotalMB: num(c.memoryTotal) ?? num(c.vram),
        clockCoreMHz: num(c.clockCore)
      }))
    } catch {
      this.gpuCache = []
    }
  }

  private async collectDisks(): Promise<void> {
    try {
      const list = await si.fsSize()
      this.diskCache = list
        .filter((d) => d.size > 0)
        .map((d) => ({
          fs: d.fs,
          mount: d.mount,
          type: d.type,
          size: d.size,
          used: d.used,
          available: d.available,
          usePercent: round(d.use)
        }))
    } catch {
      this.diskCache = []
    }
  }

  private async collectTemperature(): Promise<void> {
    try {
      const t = await si.cpuTemperature()
      const main = num(t.main)
      this.tempCache = main !== null && main > 0 ? round(main) : null
    } catch {
      this.tempCache = null
    }
    // Windows only exposes CPU temperature through WMI with admin rights on
    // most machines. If the first probe fails, stop asking.
    if (this.tempCache === null) this.tempSupported = false
  }

  private async collectDiskIo(): Promise<DiskIoLive | null> {
    if (!this.diskIoSupported) return null
    try {
      const io = await si.disksIO()
      if (!io) return null
      return { readPerSec: num(io.rIO_sec), writePerSec: num(io.wIO_sec) }
    } catch {
      this.diskIoSupported = false
      return null
    }
  }
}
