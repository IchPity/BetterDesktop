import os from 'node:os'
import si from 'systeminformation'
import type { DiskIoLive, DiskLive, GpuLive, NetworkLive, ProcessInfo, SystemStatic } from '@shared/system'
import { winHelper, type HelperDrive, type HelperProc, type HelperSample, type HelperStatic } from './win-helper'

/** Raw network counters for one interface; rates are derived by the monitor. */
export interface NetCounters extends Omit<NetworkLive, 'rxPerSec' | 'txPerSec'> {
  rxTotal: number | null
  txTotal: number | null
}

export interface SlowSample {
  network: NetCounters | null
  gpu: GpuLive | null
  diskIo: DiskIoLive | null
}

/** Everything that is too expensive for the instant tick. */
export interface MetricsProvider {
  sample(): Promise<SlowSample>
  drives(): Promise<DiskLive[]>
  swap(): Promise<{ total: number; used: number } | null>
  static(): Promise<SystemStatic>
  processes(): Promise<{ list: HelperProc[]; cpuIsCumulative: boolean }>
  dispose(): void
}

function n(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
}

/* ------------------------------------------------------------------ Windows */

const VIRTUAL = /hyper-v|virtualbox|vmware|vethernet|loopback|tap-|wan miniport|bluetooth|teredo|isatap|npcap/i

export class WindowsProvider implements MetricsProvider {
  async sample(): Promise<SlowSample> {
    const s = await winHelper.request<HelperSample>('sample')
    const candidates = s.net.filter((i) => i.up)
    const iface =
      candidates.find((i) => i.gateway && !VIRTUAL.test(`${i.name} ${i.desc}`)) ??
      candidates.find((i) => !VIRTUAL.test(`${i.name} ${i.desc}`)) ??
      candidates[0] ??
      null

    const adapters = (s.gpu ?? []).map((g) => ({ id: g.luid, load: n(g.util), dedicatedUsed: n(g.dedicated) }))
    const loads = adapters.map((a) => a.load).filter((v): v is number => v !== null)
    const mem = adapters.map((a) => a.dedicatedUsed).filter((v): v is number => v !== null)

    return {
      network: iface
        ? {
            iface: iface.name,
            ifaceName: iface.desc,
            type: iface.type === 'Wireless80211' ? 'wireless' : iface.type.toLowerCase(),
            ip4: iface.ip,
            mac: iface.mac ? iface.mac.match(/.{1,2}/g)?.join(':') ?? null : null,
            operstate: iface.up ? 'up' : 'down',
            speedMbit: iface.speed > 0 ? Math.round(iface.speed / 1e6) : null,
            rxTotal: n(iface.rx),
            txTotal: n(iface.tx)
          }
        : null,
      gpu: s.gpu
        ? {
            load: loads.length ? Math.round(Math.max(...loads) * 10) / 10 : null,
            dedicatedUsed: mem.length ? mem.reduce((a, b) => a + b, 0) : null,
            adapters
          }
        : null,
      diskIo: s.disk ? { readPerSec: n(s.disk.read), writePerSec: n(s.disk.write), busyPercent: n(s.disk.busy) } : null
    }
  }

  async drives(): Promise<DiskLive[]> {
    const list = await winHelper.request<HelperDrive[]>('drives')
    return list
      .filter((d) => d.size > 0)
      .map((d) => ({
        label: d.label || null,
        fs: d.fs,
        mount: d.mount,
        type: d.fs,
        size: d.size,
        used: d.size - d.free,
        available: d.free,
        usePercent: Math.round(((d.size - d.free) / d.size) * 1000) / 10
      }))
  }

  async swap(): Promise<{ total: number; used: number } | null> {
    const p = await winHelper.request<{ total: number; free: number } | null>('page')
    return p ? { total: p.total, used: p.total - p.free } : null
  }

  async static(): Promise<SystemStatic> {
    const s = await winHelper.request<HelperStatic>('static', 30_000)
    const cpus = os.cpus()
    return {
      cpu: {
        manufacturer: s.cpu.manufacturer.replace('GenuineIntel', 'Intel').replace('AuthenticAMD', 'AMD'),
        brand: s.cpu.name,
        physicalCores: s.cpu.cores,
        logicalCores: s.cpu.threads || cpus.length,
        baseSpeedGHz: cpus[0]?.speed ? Math.round(cpus[0].speed / 10) / 100 : null,
        maxSpeedGHz: s.cpu.maxMHz ? Math.round(s.cpu.maxMHz / 10) / 100 : null
      },
      gpus: s.gpus.map((g) => ({ model: g.model, vendor: g.vendor ?? '', vram: n(g.vram) })),
      memTotal: os.totalmem(),
      os: {
        platform: 'Windows',
        distro: s.os.caption.replace(/^Microsoft\s+/, ''),
        release: s.os.version,
        arch: os.arch(),
        hostname: os.hostname()
      }
    }
  }

  async processes(): Promise<{ list: HelperProc[]; cpuIsCumulative: boolean }> {
    return { list: await winHelper.request<HelperProc[]>('procs'), cpuIsCumulative: true }
  }

  dispose(): void {
    winHelper.dispose()
  }
}

/* ------------------------------------------------------------------ Generic (macOS / Linux) */

export class GenericProvider implements MetricsProvider {
  async sample(): Promise<SlowSample> {
    const [ifaceName, stats, graphics, io] = await Promise.all([
      si.networkInterfaceDefault().catch(() => ''),
      si.networkStats().catch(() => []),
      si.graphics().catch(() => null),
      si.disksIO().catch(() => null)
    ])
    const ifaces = await si.networkInterfaces().catch(() => [])
    const list = Array.isArray(ifaces) ? ifaces : [ifaces]
    const iface = list.find((i) => i.iface === ifaceName) ?? null
    const st = stats.find((s) => s.iface === ifaceName) ?? stats[0]
    const adapters = (graphics?.controllers ?? []).map((c, i) => ({
      id: String(i),
      load: n(c.utilizationGpu),
      dedicatedUsed: n(c.memoryUsed) !== null ? c.memoryUsed! * 1048576 : null
    }))
    const loads = adapters.map((a) => a.load).filter((v): v is number => v !== null)
    return {
      network: st
        ? {
            iface: st.iface,
            ifaceName: iface?.ifaceName ?? st.iface,
            type: iface?.type ?? null,
            ip4: iface?.ip4 || null,
            mac: iface?.mac || null,
            operstate: st.operstate,
            speedMbit: n(iface?.speed),
            rxTotal: n(st.rx_bytes),
            txTotal: n(st.tx_bytes)
          }
        : null,
      gpu: { load: loads.length ? Math.max(...loads) : null, dedicatedUsed: null, adapters },
      diskIo: io ? { readPerSec: null, writePerSec: null, busyPercent: null } : null
    }
  }

  async drives(): Promise<DiskLive[]> {
    const list = await si.fsSize()
    return list
      .filter((d) => d.size > 0)
      .map((d) => ({
        label: null,
        fs: d.fs,
        mount: d.mount,
        type: d.type,
        size: d.size,
        used: d.used,
        available: d.available,
        usePercent: Math.round(d.use * 10) / 10
      }))
  }

  async swap(): Promise<{ total: number; used: number } | null> {
    const m = await si.mem()
    return { total: m.swaptotal, used: m.swapused }
  }

  async static(): Promise<SystemStatic> {
    const [cpu, osInfo, graphics] = await Promise.all([si.cpu(), si.osInfo(), si.graphics().catch(() => null)])
    return {
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        physicalCores: cpu.physicalCores,
        logicalCores: cpu.cores,
        baseSpeedGHz: n(cpu.speed),
        maxSpeedGHz: n(cpu.speedMax)
      },
      gpus: (graphics?.controllers ?? []).map((c) => ({
        model: c.model,
        vendor: c.vendor,
        vram: n(c.vram) !== null ? c.vram! * 1048576 : null
      })),
      memTotal: os.totalmem(),
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        arch: osInfo.arch,
        hostname: osInfo.hostname
      }
    }
  }

  async processes(): Promise<{ list: HelperProc[]; cpuIsCumulative: boolean }> {
    const p = await si.processes()
    return {
      cpuIsCumulative: false,
      list: p.list.map((x) => ({
        pid: x.pid,
        name: x.name,
        cpu: x.cpu,
        ws: x.memRss * 1024,
        path: x.path || null,
        start: x.started || null
      }))
    }
  }

  dispose(): void {
    /* nothing to clean up */
  }
}

export function createProvider(): MetricsProvider {
  return process.platform === 'win32' ? new WindowsProvider() : new GenericProvider()
}

export type { ProcessInfo }
