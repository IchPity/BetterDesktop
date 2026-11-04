import { useId, useMemo } from 'react'
import { motion } from 'framer-motion'
import { clamp, cx } from '@/lib/format'

export interface Series {
  data: number[]
  color: string
  /** Fill area under the line. */
  fill?: boolean
}

/** Builds a smoothed SVG path (monotone-ish cubic) in a 0..w / 0..h box. */
function buildPath(data: number[], w: number, h: number, max: number, capacity: number): string {
  if (data.length === 0) return ''
  const step = w / Math.max(1, capacity - 1)
  const offset = (capacity - data.length) * step
  const pts = data.map((v, i) => [offset + i * step, h - (clamp(v, 0, max) / max) * h] as const)
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const cx1 = x0 + (x1 - x0) / 2
    d += ` C${cx1},${y0} ${cx1},${y1} ${x1},${y1}`
  }
  return d
}

/**
 * Lightweight live area chart. Renders in a fixed viewBox and stretches to its
 * container; strokes stay crisp via vector-effect.
 */
export function AreaChart({
  series,
  max,
  capacity,
  height = 120,
  grid = true,
  className
}: {
  series: Series[]
  /** Fixed y-max (e.g. 100 for %). If omitted, scales to data. */
  max?: number
  /** Number of points the x-axis represents (history length). */
  capacity: number
  height?: number
  grid?: boolean
  className?: string
}): React.JSX.Element {
  const uid = useId().replace(/:/g, '')
  const W = 300
  const H = 100
  const yMax = useMemo(() => {
    if (max !== undefined) return max
    const m = Math.max(1, ...series.flatMap((s) => s.data))
    return m * 1.15
  }, [series, max])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cx('block w-full overflow-visible', className)}
      style={{ height }}
    >
      <defs>
        {series.map((s, i) => (
          <linearGradient key={i} id={`${uid}-g${i}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>
      {grid &&
        [0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={H * f}
            y2={H * f}
            stroke="var(--grid-line)"
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      {series.map((s, i) => {
        const line = buildPath(s.data, W, H, yMax, capacity)
        if (!line) return null
        const startX = ((capacity - s.data.length) * W) / Math.max(1, capacity - 1)
        const area = `${line} L${W},${H} L${startX},${H} Z`
        return (
          <g key={i}>
            {s.fill !== false && <path d={area} fill={`url(#${uid}-g${i})`} />}
            <path
              d={line}
              fill="none"
              stroke={s.color}
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
    </svg>
  )
}

/** Circular progress ring with a value in the middle. */
export function Ring({
  value,
  size = 84,
  stroke = 7,
  color = 'var(--accent)',
  children
}: {
  value: number | null
  size?: number
  stroke?: number
  color?: string
  children?: React.ReactNode
}): React.JSX.Element {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = value === null ? 0 : clamp(value, 0, 100) / 100
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

/** Horizontal usage bar. */
export function Bar({
  value,
  color,
  className
}: {
  value: number | null
  color?: string
  className?: string
}): React.JSX.Element {
  const pct = value === null ? 0 : clamp(value, 0, 100)
  const tone = color ?? (pct >= 90 ? 'var(--danger)' : pct >= 75 ? 'var(--warning)' : 'var(--accent)')
  return (
    <div className={cx('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: tone }}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 24 }}
      />
    </div>
  )
}

/** Compact per-core heat grid. */
export function CoreGrid({ cores }: { cores: number[] }): React.JSX.Element {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(44px, 1fr))` }}>
      {cores.map((load, i) => (
        <div
          key={i}
          title={`Core ${i}: ${load.toFixed(0)}%`}
          className="relative h-11 overflow-hidden rounded-md border border-border bg-surface-2"
        >
          <motion.div
            className="absolute inset-x-0 bottom-0"
            style={{
              background: `color-mix(in oklab, ${load >= 90 ? 'var(--danger)' : load >= 70 ? 'var(--warning)' : 'var(--accent)'} 55%, transparent)`
            }}
            initial={false}
            animate={{ height: `${clamp(load, 0, 100)}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          />
          <div className="relative flex h-full flex-col items-center justify-center leading-none">
            <span className="tabular text-[11px] font-semibold text-fg">{load.toFixed(0)}</span>
            <span className="mt-0.5 text-[9px] text-faint">C{i}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
