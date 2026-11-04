import { Cpu, Gauge, HardDrive, ListTree, MemoryStick, Monitor, Network } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { AreaChart, Bar, CoreGrid, Ring } from '@/components/ui/charts'
import { Segmented, Skeleton, Unavailable } from '@/components/ui/controls'
import { formatBits, formatBytes, formatPercent, formatRate } from '@/lib/format'
import { useSystem } from '@/stores/system'
import { useUi } from '@/stores/ui'
import { ProcessManager } from './ProcessManager'

type Tab = 'hardware' | 'processes'

export function PcControlCenter(): React.JSX.Element {
  const subview = useUi((s) => s.subview)
  const navigate = useUi((s) => s.navigate)
  const tab: Tab = subview === 'processes' ? 'processes' : 'hardware'

  return (
    <Page>
      <PageHeader
        icon={<Gauge />}
        title="PC Control Center"
        description="Live hardware metrics read directly from this machine."
        actions={
          <Segmented<Tab>
            layoutId="pc-tab"
            value={tab}
            onChange={(t) => navigate('pc', t)}
            options={[
              { value: 'hardware', label: <><Cpu className="h-3.5 w-3.5" /> Hardware</> },
              { value: 'processes', label: <><ListTree className="h-3.5 w-3.5" /> Processes</> }
            ]}
          />
        }
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
        >
          {tab === 'hardware' ? <Hardware /> : <ProcessManager />}
        </motion.div>
      </AnimatePresence>
    </Page>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="text-[11px] text-faint">{label}</div>
      <div className="tabular mt-0.5 truncate text-[13px] font-medium">{value}</div>
    </div>
  )
}

function Hardware(): React.JSX.Element {
  const snap = useSystem((s) => s.snapshot)
  const st = useSystem((s) => s.static)
  const h = useSystem((s) => s.history)
  const cap = useSystem((s) => s.historyLength)

  if (!snap) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    )
  }

  const memPct = (snap.mem.used / snap.mem.total) * 100
  const tempNote = 'Windows only exposes CPU temperature to apps running with administrator rights on most systems.'

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* CPU */}
      <Card className="col-span-12 xl:col-span-7">
        <CardHeader icon={<Cpu />} title="Processor" subtitle={st ? `${st.cpu.manufacturer} ${st.cpu.brand}` : '…'} />
        <CardBody>
          <div className="flex gap-5">
            <Ring value={snap.cpu.load} size={108} stroke={9}>
              <span className="tabular text-2xl font-semibold">{snap.cpu.load.toFixed(0)}%</span>
              <span className="text-[10px] text-faint">load</span>
            </Ring>
            <div className="grid flex-1 grid-cols-2 gap-2 lg:grid-cols-4">
              <Stat label="Base clock" value={snap.cpu.speedGHz !== null ? `${snap.cpu.speedGHz.toFixed(2)} GHz` : '—'} />
              <Stat label="Max clock" value={st?.cpu.maxSpeedGHz ? `${st.cpu.maxSpeedGHz} GHz` : '—'} />
              <Stat label="Cores / threads" value={st ? `${st.cpu.physicalCores} / ${st.cpu.logicalCores}` : '—'} />
              <Stat
                label="Temperature"
                value={snap.cpu.temperatureC !== null ? `${snap.cpu.temperatureC} °C` : <Unavailable reason={tempNote} />}
              />
            </div>
          </div>
          <div className="mt-4">
            <AreaChart series={[{ data: h.cpu, color: 'var(--accent)' }]} max={100} capacity={cap} height={130} />
          </div>
        </CardBody>
      </Card>

      {/* Cores */}
      <Card className="col-span-12 xl:col-span-5">
        <CardHeader icon={<Cpu />} title="Per-core load" subtitle={`${snap.cpu.cores.length} logical processors`} />
        <CardBody>
          <CoreGrid cores={snap.cpu.cores} />
        </CardBody>
      </Card>

      {/* Memory */}
      <Card className="col-span-12 xl:col-span-6">
        <CardHeader icon={<MemoryStick />} title="Memory" subtitle={`${formatBytes(snap.mem.total)} installed`} />
        <CardBody>
          <div className="flex gap-5">
            <Ring value={memPct} size={108} stroke={9} color="var(--info)">
              <span className="tabular text-2xl font-semibold">{memPct.toFixed(0)}%</span>
              <span className="text-[10px] text-faint">used</span>
            </Ring>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <Stat label="In use" value={formatBytes(snap.mem.used)} />
              <Stat label="Available" value={formatBytes(snap.mem.available)} />
              <Stat label="Total" value={formatBytes(snap.mem.total)} />
              <Stat
                label="Page file"
                value={snap.mem.swapTotal > 0 ? `${formatBytes(snap.mem.swapUsed)} / ${formatBytes(snap.mem.swapTotal)}` : '—'}
              />
            </div>
          </div>
          <div className="mt-4">
            <AreaChart series={[{ data: h.mem, color: 'var(--info)' }]} max={100} capacity={cap} height={110} />
          </div>
        </CardBody>
      </Card>

      {/* GPU */}
      <Card className="col-span-12 xl:col-span-6">
        <CardHeader icon={<Monitor />} title="Graphics" subtitle={`${st?.gpus.length ?? 0} adapter(s)`} />
        <CardBody>
          {snap.gpu === null ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Load (busiest adapter)" value={formatPercent(snap.gpu.load)} />
                <Stat label="Dedicated VRAM in use" value={formatBytes(snap.gpu.dedicatedUsed)} />
                <Stat
                  label="Temperature"
                  value={
                    <Unavailable reason="GPU temperature is only exposed through vendor tools (e.g. nvidia-smi). Polling them keeps a sleeping laptop GPU awake, so BetterDesktop does not do it." />
                  }
                />
              </div>
              <AreaChart series={[{ data: h.gpu, color: 'var(--success)' }]} max={100} capacity={cap} height={90} />
              {(st?.gpus ?? []).map((g, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{g.model}</div>
                    <div className="truncate text-[11px] text-faint">{g.vendor}</div>
                  </div>
                  <span className="tabular shrink-0 text-xs text-muted">{g.vram ? `${formatBytes(g.vram)} VRAM` : 'Shared memory'}</span>
                </div>
              ))}
              <p className="text-[11px] text-faint">
                Load and memory come from Windows GPU performance counters – the same source Task Manager uses – and work for
                every vendor.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Storage */}
      <Card className="col-span-12 xl:col-span-6">
        <CardHeader icon={<HardDrive />} title="Storage" subtitle="Volumes refresh every 30 seconds" />
        <CardBody>
          {snap.disks === null ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Read" value={snap.diskIo ? formatRate(snap.diskIo.readPerSec) : '—'} />
                <Stat label="Write" value={snap.diskIo ? formatRate(snap.diskIo.writePerSec) : '—'} />
                <Stat label="Active time" value={snap.diskIo ? formatPercent(snap.diskIo.busyPercent) : '—'} />
              </div>
              {snap.disks.map((d) => (
                <div key={d.mount} className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-[13px] font-medium">
                      {d.label ? `${d.label} (${d.mount})` : d.mount}{' '}
                      <span className="ml-1 text-xs text-faint">{d.type}</span>
                    </span>
                    <span className="tabular text-muted">{d.usePercent.toFixed(0)}%</span>
                  </div>
                  <Bar value={d.usePercent} />
                  <div className="tabular mt-2 flex justify-between text-[11px] text-muted">
                    <span>{formatBytes(d.used)} used</span>
                    <span>
                      {formatBytes(d.available)} free · {formatBytes(d.size)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border-strong px-3 py-2 text-xs text-muted">
                <span>Drive health (S.M.A.R.T.)</span>
                <Unavailable reason="Reading S.M.A.R.T. data on Windows requires administrator rights. Planned via an optional elevated helper." />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Network */}
      <Card className="col-span-12 xl:col-span-6">
        <CardHeader icon={<Network />} title="Network" subtitle={snap.network.ifaceName ?? snap.network.iface ?? 'No interface'} />
        <CardBody>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Download" value={formatBits(snap.network.rxPerSec)} />
            <Stat label="Upload" value={formatBits(snap.network.txPerSec)} />
          </div>
          <AreaChart
            className="mt-4"
            series={[
              { data: h.rx, color: 'var(--accent)' },
              { data: h.tx, color: 'var(--warning)', fill: false }
            ]}
            capacity={cap}
            height={110}
          />
          <div className="mt-2 flex gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent" /> Download
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning" /> Upload
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
