const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

export function formatBytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  let i = 0
  let v = bytes
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : digits)} ${UNITS[i]}`
}

export function formatRate(bytesPerSec: number | null | undefined): string {
  if (bytesPerSec === null || bytesPerSec === undefined) return '—'
  return `${formatBytes(bytesPerSec)}/s`
}

/** Network speeds are usually shown in bits. */
export function formatBits(bytesPerSec: number | null | undefined): string {
  if (bytesPerSec === null || bytesPerSec === undefined) return '—'
  const bits = bytesPerSec * 8
  if (bits < 1000) return `${Math.round(bits)} bit/s`
  if (bits < 1e6) return `${(bits / 1e3).toFixed(1)} Kbit/s`
  if (bits < 1e9) return `${(bits / 1e6).toFixed(1)} Mbit/s`
  return `${(bits / 1e9).toFixed(2)} Gbit/s`
}

export function formatPercent(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${v.toFixed(digits)}%`
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** Status colour for a utilisation percentage. */
export function loadTone(pct: number | null | undefined): 'ok' | 'warn' | 'crit' {
  if (pct === null || pct === undefined) return 'ok'
  if (pct >= 90) return 'crit'
  if (pct >= 70) return 'warn'
  return 'ok'
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
