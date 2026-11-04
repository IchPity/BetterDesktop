import {
  ArrowDown,
  ArrowUp,
  Cpu,
  HardDrive,
  Layers,
  ListTree,
  MemoryStick,
  Monitor,
  MonitorCog,
  Network,
  Zap
} from 'lucide-react'
import type { ReactNode } from 'react'
import { SYSTEM_TOOLS, type SystemTool } from '@shared/app'
import type { WidgetSize, WidgetType } from '@shared/settings'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { AreaChart, Bar, CoreGrid } from '@/components/ui/charts'
import { EmptyState, Skeleton, Unavailable } from '@/components/ui/controls'
import { Button } from '@/components/ui/Button'
import { useProcesses } from '@/hooks/useProcesses'
import { formatBits, formatBytes, formatPercent, cx } from '@/lib/format'
import { useSystem } from '@/stores/system'
import { toast, useUi } from '@/stores/ui'

export interface WidgetMeta {
  type: WidgetType
  title: string
  description: string
  icon: ReactNode
  defaultSize: WidgetSize
  Component: (props: { size: WidgetSize }) => React.JSX.Element
}

/* ------------------------------------------------------------------ helpers */

function Metric({
  label,
  value,
  hint
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-faint">{label}</div>
      <div className="tabular truncate text-[13px] font-medium text-fg">{value}</div>
      {hint && <div className="text-[11px] text-faint">{hint}</div>}
    </div>
  )
}

function BigValue({ value, unit, sub }: { value: string; unit?: string; sub?: ReactNode }): React.JSX.Element {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className="tabular font-display text-[30px] leading-none font-semibold tracking-tight">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  )
}

function Loading(): React.JSX.Element {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

/* ------------------------------------------------------------------ CPU */

export function CpuWidget(): React.JSX.Element {
  const snap = useSystem((s) => s.snapshot)
  const st = useSystem((s) => s.static)
  const hist = useSystem((s) => s.history.cpu)
  const cap = useSystem((s) => s.historyLength)
  return (
    <Card className="h-full">
      <CardHeader icon={<Cpu />} title="CPU" subtitle={st?.cpu.brand ?? 'Detecting…'} />
      <CardBody>
        {!snap ? (
          <Loading />
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <BigValue
                value={snap.cpu.load.toFixed(0)}
                unit="%"
                sub={`${st?.cpu.physicalCores ?? '–'} cores · ${st?.cpu.logicalCores ?? '–'} threads`}
              />
              <div className="flex gap-5">
                <Metric label="Base clock" value={snap.cpu.speedGHz !== null ? `${snap.cpu.speedGHz.toFixed(2)} GHz` : '—'} />
                <Metric
                  label="Temp"
                  value={
                    snap.cpu.temperatureC !== null ? (
                      `${snap.cpu.temperatureC.toFixed(0)} °C`
                    ) : (
                      <Unavailable reason="Windows only exposes the CPU temperature to apps running as administrator on most systems." />
                    )
                  }
                />
              </div>
            </div>
            <AreaChart className="mt-3" series={[{ data: hist, color: 'var(--accent)' }]} max={100} capacity={cap} height={84} />
          </>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ Cores */

export function CoresWidget(): React.JSX.Element {
  const snap = useSystem((s) => s.snapshot)
  return (
    <Card className="h-full">
      <CardHeader icon={<Layers />} title="CPU cores" subtitle="Load per logical processor" />
      <CardBody>{snap ? <CoreGrid cores={snap.cpu.cores} /> : <Loading />}</CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ Memory */

export function MemoryWidget(): React.JSX.Element {
  const snap = useSystem((s) => s.snapshot)
  const hist = useSystem((s) => s.history.mem)
  const cap = useSystem((s) => s.historyLength)
  const pct = snap ? (snap.mem.used / snap.mem.total) * 100 : null
  return (
    <Card className="h-full">
      <CardHeader icon={<MemoryStick />} title="Memory" subtitle={snap ? `${formatBytes(snap.mem.total)} installed` : ' '} />
      <CardBody>
        {!snap ? (
          <Loading />
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <BigValue value={pct!.toFixed(0)} unit="%" sub={`${formatBytes(snap.mem.used)} in use`} />
              <div className="flex gap-5">
                <Metric label="Available" value={formatBytes(snap.mem.available)} />
                <Metric
                  label="Page file"
                  value={snap.mem.swapTotal > 0 ? `${formatBytes(snap.mem.swapUsed)} / ${formatBytes(snap.mem.swapTotal)}` : '—'}
                />
              </div>
            </div>
            <AreaChart className="mt-3" series={[{ data: hist, color: 'var(--info)' }]} max={100} capacity={cap} height={84} />
          </>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ GPU */

export function GpuWidget(): React.JSX.Element {
  const gpu = useSystem((s) => s.snapshot?.gpu)
  const st = useSystem((s) => s.static)
  const hist = useSystem((s) => s.history.gpu)
  const cap = useSystem((s) => s.historyLength)
  const adapters = st?.gpus ?? []
  const totalVram = adapters.reduce((sum, g) => sum + (g.vram ?? 0), 0)
  const names = adapters.map((g) => g.model).join(' · ')

  return (
    <Card className="h-full">
      <CardHeader icon={<Monitor />} title="GPU" subtitle={names || 'Detecting…'} />
      <CardBody>
        {gpu === null || gpu === undefined ? (
          <Loading />
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              {gpu.load !== null ? (
                <BigValue value={gpu.load.toFixed(0)} unit="%" sub="Busiest adapter" />
              ) : (
                <div>
                  <div className="text-xs text-muted">Utilization</div>
                  <Unavailable
                    className="mt-1"
                    reason="Windows did not provide GPU performance counters (requires WDDM 2.4+ drivers)."
                  />
                </div>
              )}
              <div className="flex gap-5">
                <Metric label="Dedicated VRAM in use" value={formatBytes(gpu.dedicatedUsed)} />
                <Metric label="Installed" value={totalVram > 0 ? formatBytes(totalVram) : '—'} />
              </div>
            </div>
            <AreaChart className="mt-3" series={[{ data: hist, color: 'var(--success)' }]} max={100} capacity={cap} height={84} />
          </>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ Network */

export function NetworkWidget(): React.JSX.Element {
  const snap = useSystem((s) => s.snapshot)
  const rx = useSystem((s) => s.history.rx)
  const tx = useSystem((s) => s.history.tx)
  const cap = useSystem((s) => s.historyLength)
  const net = snap?.network
  return (
    <Card className="h-full">
      <CardHeader
        icon={<Network />}
        title="Network"
        subtitle={net ? (net.ifaceName ?? net.iface ?? 'No active interface') : ' '}
        actions={
          net?.operstate && (
            <span
              className={cx(
                'flex items-center gap-1.5 text-[11px]',
                net.operstate === 'up' ? 'text-success' : 'text-warning'
              )}
            >
              <span className={cx('h-1.5 w-1.5 rounded-full', net.operstate === 'up' ? 'bg-success' : 'bg-warning')} />
              {net.operstate === 'up' ? 'Connected' : net.operstate}
            </span>
          )
        }
      />
      <CardBody>
        {!net ? (
          <Loading />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-faint">
                  <ArrowDown className="h-3 w-3 text-accent" /> Download
                </div>
                <div className="tabular text-lg font-semibold">{net.rxPerSec === null ? '—' : formatBits(net.rxPerSec)}</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[11px] text-faint">
                  <ArrowUp className="h-3 w-3 text-warning" /> Upload
                </div>
                <div className="tabular text-lg font-semibold">{net.txPerSec === null ? '—' : formatBits(net.txPerSec)}</div>
              </div>
            </div>
            <AreaChart
              className="mt-3"
              series={[
                { data: rx, color: 'var(--accent)' },
                { data: tx, color: 'var(--warning)', fill: false }
              ]}
              capacity={cap}
              height={84}
            />
          </>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ Storage */

export function StorageWidget(): React.JSX.Element {
  const disks = useSystem((s) => s.snapshot?.disks)
  return (
    <Card className="h-full">
      <CardHeader icon={<HardDrive />} title="Storage" subtitle={disks ? `${disks.length} volume${disks.length === 1 ? '' : 's'}` : ' '} />
      <CardBody>
        {disks === null || disks === undefined ? (
          <Loading />
        ) : disks.length === 0 ? (
          <EmptyState title="No volumes reported" />
        ) : (
          <div className="space-y-3.5">
            {disks.map((d) => (
              <div key={d.mount}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {d.mount} <span className="ml-1 text-faint">{d.type}</span>
                  </span>
                  <span className="tabular text-muted">
                    {formatBytes(d.available)} free of {formatBytes(d.size)}
                  </span>
                </div>
                <Bar value={d.usePercent} />
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ Processes */

export function ProcessesWidget({ size }: { size: WidgetSize }): React.JSX.Element {
  const { data, error } = useProcesses(5000)
  const navigate = useUi((s) => s.navigate)
  const rows = size === 'sm' ? 5 : 7
  const top = data ? [...data.processes].sort((a, b) => b.cpu - a.cpu || b.memRss - a.memRss).slice(0, rows) : []
  return (
    <Card className="h-full">
      <CardHeader
        icon={<ListTree />}
        title="Top processes"
        subtitle={data ? `${data.total} running` : 'Loading…'}
        actions={
          <Button size="sm" variant="ghost" onClick={() => navigate('pc', 'processes')}>
            View all
          </Button>
        }
      />
      <CardBody>
        {error ? (
          <EmptyState title="Could not read processes" description={error} />
        ) : !data ? (
          <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] text-faint">
                <th className="pb-1.5 font-normal">Name</th>
                <th className="pb-1.5 text-right font-normal">CPU</th>
                <th className="pb-1.5 text-right font-normal">Memory</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p) => (
                <tr key={p.pid} className="border-t border-border">
                  <td className="max-w-0 truncate py-1.5 pr-2" title={p.path ?? p.name}>
                    {p.name}
                  </td>
                  <td className="tabular w-16 py-1.5 text-right">{formatPercent(p.cpu, 1)}</td>
                  <td className="tabular w-20 py-1.5 text-right text-muted">{formatBytes(p.memRss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ System info */

export function SystemInfoWidget(): React.JSX.Element {
  const st = useSystem((s) => s.static)
  const error = useSystem((s) => s.staticError)
  return (
    <Card className="h-full">
      <CardHeader icon={<MonitorCog />} title="This PC" subtitle={st?.os.hostname ?? ' '} />
      <CardBody>
        {error ? (
          <EmptyState title="System info unavailable" description={error} />
        ) : !st ? (
          <Loading />
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
            <dt className="text-faint">OS</dt>
            <dd className="truncate">
              {st.os.distro} <span className="text-muted">{st.os.release}</span>
            </dd>
            <dt className="text-faint">Arch</dt>
            <dd>{st.os.arch}</dd>
            <dt className="text-faint">CPU</dt>
            <dd className="truncate" title={st.cpu.brand}>
              {st.cpu.manufacturer} {st.cpu.brand}
            </dd>
            <dt className="text-faint">Clock</dt>
            <dd className="tabular">
              {st.cpu.baseSpeedGHz !== null ? `${st.cpu.baseSpeedGHz} GHz` : '—'}
              {st.cpu.maxSpeedGHz !== null && st.cpu.maxSpeedGHz !== st.cpu.baseSpeedGHz && (
                <span className="text-muted"> · max {st.cpu.maxSpeedGHz} GHz</span>
              )}
            </dd>
            <dt className="text-faint">Memory</dt>
            <dd className="tabular">{formatBytes(st.memTotal)}</dd>
            <dt className="text-faint">GPU</dt>
            <dd className="truncate">{st.gpus.map((g) => g.model).join(', ') || '—'}</dd>
          </dl>
        )}
      </CardBody>
    </Card>
  )
}

/* ------------------------------------------------------------------ Quick actions */

const QUICK_TOOLS: SystemTool[] = ['taskmgr', 'explorer', 'settings-display', 'settings-sound', 'settings-network', 'settings-storage']

export function QuickActionsWidget(): React.JSX.Element {
  const navigate = useUi((s) => s.navigate)
  const setPaletteOpen = useUi((s) => s.setPaletteOpen)

  const launch = async (tool: SystemTool): Promise<void> => {
    const res = await window.bd.app.launchTool(tool)
    if (!res.ok) toast({ tone: 'danger', title: `Could not open ${SYSTEM_TOOLS[tool]}`, description: res.error })
  }

  return (
    <Card className="h-full">
      <CardHeader icon={<Zap />} title="Quick actions" />
      <CardBody>
        <div className="grid grid-cols-2 gap-1.5">
          <QuickButton onClick={() => setPaletteOpen(true)}>Command palette</QuickButton>
          <QuickButton onClick={() => navigate('pc', 'processes')}>Process manager</QuickButton>
          {QUICK_TOOLS.map((t) => (
            <QuickButton key={t} onClick={() => void launch(t)}>
              {SYSTEM_TOOLS[t]}
            </QuickButton>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

function QuickButton({ children, onClick }: { children: ReactNode; onClick: () => void }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="truncate rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-left text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-fg"
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ Registry */

export const WIDGETS: Record<WidgetType, WidgetMeta> = {
  cpu: { type: 'cpu', title: 'CPU', description: 'Total load, clock and history', icon: <Cpu />, defaultSize: 'md', Component: CpuWidget },
  'cpu-cores': {
    type: 'cpu-cores',
    title: 'CPU cores',
    description: 'Load per logical processor',
    icon: <Layers />,
    defaultSize: 'lg',
    Component: CoresWidget
  },
  memory: {
    type: 'memory',
    title: 'Memory',
    description: 'RAM usage and history',
    icon: <MemoryStick />,
    defaultSize: 'md',
    Component: MemoryWidget
  },
  gpu: { type: 'gpu', title: 'GPU', description: 'Utilization and VRAM', icon: <Monitor />, defaultSize: 'md', Component: GpuWidget },
  network: {
    type: 'network',
    title: 'Network',
    description: 'Download / upload speed',
    icon: <Network />,
    defaultSize: 'md',
    Component: NetworkWidget
  },
  storage: {
    type: 'storage',
    title: 'Storage',
    description: 'Free space per volume',
    icon: <HardDrive />,
    defaultSize: 'md',
    Component: StorageWidget
  },
  processes: {
    type: 'processes',
    title: 'Top processes',
    description: 'Heaviest processes by CPU',
    icon: <ListTree />,
    defaultSize: 'lg',
    Component: ProcessesWidget
  },
  'system-info': {
    type: 'system-info',
    title: 'This PC',
    description: 'OS, CPU, memory and GPU',
    icon: <MonitorCog />,
    defaultSize: 'md',
    Component: SystemInfoWidget
  },
  'quick-actions': {
    type: 'quick-actions',
    title: 'Quick actions',
    description: 'Open Windows tools and modules',
    icon: <Zap />,
    defaultSize: 'md',
    Component: QuickActionsWidget
  }
}

