/**
 * System information types shared between main and renderer.
 * `null` always means "not available on this machine / OS" – the UI must
 * show that explicitly instead of inventing a value.
 */

export interface CpuStatic {
  manufacturer: string
  brand: string
  physicalCores: number
  logicalCores: number
  baseSpeedGHz: number | null
  maxSpeedGHz: number | null
}

export interface GpuStatic {
  model: string
  vendor: string
  /** Dedicated video memory in bytes. */
  vram: number | null
}

export interface OsStatic {
  platform: string
  distro: string
  release: string
  arch: string
  hostname: string
}

export interface SystemStatic {
  cpu: CpuStatic
  gpus: GpuStatic[]
  memTotal: number
  os: OsStatic
}

export interface CpuLive {
  load: number
  cores: number[]
  speedGHz: number | null
  temperatureC: number | null
}

export interface MemLive {
  total: number
  used: number
  available: number
  swapTotal: number
  swapUsed: number
}

export interface GpuAdapterLive {
  /** Adapter LUID as reported by Windows performance counters. */
  id: string
  load: number | null
  dedicatedUsed: number | null
}

export interface GpuLive {
  /** Load of the busiest adapter (max over engine types) – same method as Task Manager. */
  load: number | null
  /** Dedicated video memory in use across all adapters, in bytes. */
  dedicatedUsed: number | null
  adapters: GpuAdapterLive[]
}

export interface NetworkLive {
  iface: string | null
  ifaceName: string | null
  type: string | null
  ip4: string | null
  mac: string | null
  operstate: string | null
  speedMbit: number | null
  rxPerSec: number | null
  txPerSec: number | null
  rxTotal: number | null
  txTotal: number | null
}

export interface DiskLive {
  label: string | null
  fs: string
  mount: string
  type: string
  size: number
  used: number
  available: number
  usePercent: number
}

export interface DiskIoLive {
  /** Bytes per second across all physical disks. */
  readPerSec: number | null
  writePerSec: number | null
  /** Percentage of time the disks were busy. */
  busyPercent: number | null
}

export interface SystemSnapshot {
  timestamp: number
  cpu: CpuLive
  mem: MemLive
  gpu: GpuLive | null
  network: NetworkLive
  disks: DiskLive[] | null
  diskIo: DiskIoLive | null
}

export interface ProcessInfo {
  pid: number
  name: string
  /** CPU usage in percent of the whole machine since the previous sample. */
  cpu: number
  /** Working set in bytes. */
  memRss: number
  memPercent: number
  path: string | null
  started: string | null
  /** Critical OS process – BetterDesktop refuses to terminate it. */
  protected: boolean
}

export interface ProcessListResult {
  processes: ProcessInfo[]
  total: number
  timestamp: number
}

export type KillResult = { ok: true } | { ok: false; error: string }
