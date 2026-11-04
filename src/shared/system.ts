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
  vramMB: number | null
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

export interface GpuLive {
  model: string
  utilization: number | null
  temperatureC: number | null
  vramUsedMB: number | null
  vramTotalMB: number | null
  clockCoreMHz: number | null
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
  fs: string
  mount: string
  type: string
  size: number
  used: number
  available: number
  usePercent: number
}

export interface DiskIoLive {
  readPerSec: number | null
  writePerSec: number | null
}

export interface SystemSnapshot {
  timestamp: number
  cpu: CpuLive
  mem: MemLive
  gpus: GpuLive[] | null
  network: NetworkLive
  disks: DiskLive[] | null
  diskIo: DiskIoLive | null
}

export interface ProcessInfo {
  pid: number
  parentPid: number
  name: string
  cpu: number
  memRss: number
  memPercent: number
  user: string | null
  path: string | null
  started: string | null
}

export interface ProcessListResult {
  processes: ProcessInfo[]
  total: number
  running: number
  timestamp: number
}

export type KillResult = { ok: true } | { ok: false; error: string }
