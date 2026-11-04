import { ArrowDown, ArrowUp, Clock, Network, Radar, Wifi } from 'lucide-react'
import { useMemo } from 'react'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { AreaChart } from '@/components/ui/charts'
import { Badge, EmptyState, Skeleton } from '@/components/ui/controls'
import { Button } from '@/components/ui/Button'
import { cx, formatBits, formatBytes, formatDuration } from '@/lib/format'
import { useSystem } from '@/stores/system'
import { toast } from '@/stores/ui'

export function NetworkMonitor(): React.JSX.Element {
  const snap = useSystem((s) => s.snapshot)
  const rx = useSystem((s) => s.history.rx)
  const tx = useSystem((s) => s.history.tx)
  const cap = useSystem((s) => s.historyLength)
  const session = useSystem((s) => s.session)
  const sessionStart = useSystem((s) => s.sessionStart)
  const log = useSystem((s) => s.connectionLog)

  const peak = useMemo(() => ({ rx: Math.max(0, ...rx), tx: Math.max(0, ...tx) }), [rx, tx])
  const avg = useMemo(
    () => ({
      rx: rx.length ? rx.reduce((a, b) => a + b, 0) / rx.length : 0,
      tx: tx.length ? tx.reduce((a, b) => a + b, 0) / tx.length : 0
    }),
    [rx, tx]
  )

  const net = snap?.network
  const sessionRx = net?.rxTotal != null && session.rxStart != null ? net.rxTotal - session.rxStart : null
  const sessionTx = net?.txTotal != null && session.txStart != null ? net.txTotal - session.txStart : null

  const openSettings = async (): Promise<void> => {
    const res = await window.bd.app.launchTool('settings-network')
    if (!res.ok) toast({ tone: 'danger', title: 'Could not open network settings', description: res.error })
  }

  return (
    <Page>
      <PageHeader
        icon={<Network />}
        title="Network Monitor"
        description="Throughput and details of your active connection."
        actions={<Button onClick={() => void openSettings()}>Windows network settings</Button>}
      />
      {!net ? (
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="col-span-2 h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <Card className="col-span-12 xl:col-span-8">
            <CardHeader icon={<Wifi />} title="Live throughput" subtitle={`Last ${cap} samples`} />
            <CardBody>
              <div className="mb-4 grid grid-cols-2 gap-6 lg:grid-cols-4">
                <Speed icon={<ArrowDown className="h-3.5 w-3.5 text-accent" />} label="Download" value={formatBits(net.rxPerSec)} />
                <Speed icon={<ArrowUp className="h-3.5 w-3.5 text-warning" />} label="Upload" value={formatBits(net.txPerSec)} />
                <Speed label="Peak ↓ / ↑" value={`${formatBits(peak.rx)} / ${formatBits(peak.tx)}`} small />
                <Speed label="Average ↓ / ↑" value={`${formatBits(avg.rx)} / ${formatBits(avg.tx)}`} small />
              </div>
              <AreaChart
                series={[
                  { data: rx, color: 'var(--accent)' },
                  { data: tx, color: 'var(--warning)', fill: false }
                ]}
                capacity={cap}
                height={220}
              />
            </CardBody>
          </Card>

          <Card className="col-span-12 xl:col-span-4">
            <CardHeader
              icon={<Network />}
              title="Interface"
              actions={
                <Badge tone={net.operstate === 'up' ? 'success' : 'warning'}>
                  {net.operstate === 'up' ? 'Connected' : (net.operstate ?? 'Unknown')}
                </Badge>
              }
            />
            <CardBody>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-xs" data-selectable>
                <dt className="text-faint">Name</dt>
                <dd className="truncate">{net.ifaceName ?? net.iface ?? '—'}</dd>
                <dt className="text-faint">Type</dt>
                <dd className="capitalize">{net.type ?? '—'}</dd>
                <dt className="text-faint">IPv4</dt>
                <dd className="tabular">{net.ip4 ?? '—'}</dd>
                <dt className="text-faint">MAC</dt>
                <dd className="tabular">{net.mac ?? '—'}</dd>
                <dt className="text-faint">Link speed</dt>
                <dd className="tabular">{net.speedMbit !== null ? `${net.speedMbit} Mbit/s` : '—'}</dd>
              </dl>
            </CardBody>
          </Card>

          <Card className="col-span-12 lg:col-span-6 xl:col-span-4">
            <CardHeader icon={<Clock />} title="This session" subtitle={`Since BetterDesktop started · ${formatDuration(Date.now() - sessionStart)}`} />
            <CardBody>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                  <div className="text-[11px] text-faint">Received</div>
                  <div className="tabular text-[15px] font-semibold">{formatBytes(sessionRx)}</div>
                </div>
                <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                  <div className="text-[11px] text-faint">Sent</div>
                  <div className="tabular text-[15px] font-semibold">{formatBytes(sessionTx)}</div>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-faint">
                Interface totals since boot: {formatBytes(net.rxTotal)} received · {formatBytes(net.txTotal)} sent
              </div>
            </CardBody>
          </Card>

          <Card className="col-span-12 lg:col-span-6 xl:col-span-4">
            <CardHeader icon={<Clock />} title="Connection history" subtitle="Status changes in this session" />
            <CardBody>
              {log.length === 0 ? (
                <EmptyState title="No events yet" />
              ) : (
                <ol className="space-y-2">
                  {log.slice(0, 8).map((e, i) => (
                    <li key={i} className="flex items-center gap-3 text-xs">
                      <span className={cx('h-2 w-2 rounded-full', e.state === 'up' ? 'bg-success' : 'bg-warning')} />
                      <span className="flex-1 truncate">
                        {e.state === 'up' ? 'Connected' : e.state} · <span className="text-muted">{e.iface ?? 'unknown'}</span>
                      </span>
                      <span className="tabular text-faint">{new Date(e.at).toLocaleTimeString()}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card className="col-span-12 xl:col-span-4">
            <CardHeader icon={<Radar />} title="Local devices" actions={<Badge>Planned</Badge>} />
            <CardBody>
              <p className="text-xs leading-relaxed text-muted">
                Discovering devices on your own network (ARP table / mDNS) is not implemented yet. It will only scan the local
                subnet you are connected to and only after you start it manually.
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </Page>
  )
}

function Speed({
  icon,
  label,
  value,
  small
}: {
  icon?: React.ReactNode
  label: string
  value: string
  small?: boolean
}): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] text-faint">
        {icon}
        {label}
      </div>
      <div className={cx('tabular font-semibold', small ? 'text-[13px]' : 'text-xl')}>{value}</div>
    </div>
  )
}
