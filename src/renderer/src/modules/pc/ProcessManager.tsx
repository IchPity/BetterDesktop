import { ArrowDown, ArrowUp, RefreshCw, Search, Skull } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ProcessInfo } from '@shared/system'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, EmptyState, Skeleton, Switch } from '@/components/ui/controls'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useProcesses } from '@/hooks/useProcesses'
import { cx, formatBytes, formatPercent } from '@/lib/format'
import { toast } from '@/stores/ui'

type SortKey = 'name' | 'pid' | 'cpu' | 'memRss'

export function ProcessManager(): React.JSX.Element {
  const [auto, setAuto] = useState(true)
  const { data, error, loading, refresh } = useProcesses(3000, auto)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'cpu', dir: 'desc' })
  const [target, setTarget] = useState<ProcessInfo | null>(null)
  const [killing, setKilling] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)

  const rows = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const list = q
      ? data.processes.filter((p) => p.name.toLowerCase().includes(q) || String(p.pid).includes(q) || p.path?.toLowerCase().includes(q))
      : data.processes.slice()
    const dir = sort.dir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
      return ((av as number) - (bv as number)) * dir
    })
    return list
  }, [data, query, sort])

  const totals = useMemo(() => {
    if (!data) return null
    return {
      cpu: data.processes.reduce((s, p) => s + p.cpu, 0),
      mem: data.processes.reduce((s, p) => s + p.memRss, 0)
    }
  }, [data])

  const toggleSort = (key: SortKey): void =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }))

  const kill = async (): Promise<void> => {
    if (!target) return
    setKilling(true)
    try {
      const res = await window.bd.processes.kill(target.pid, target.name)
      if (res.ok) {
        toast({ tone: 'success', title: `${target.name} terminated`, description: `PID ${target.pid}` })
        void refresh()
      } else {
        toast({ tone: 'danger', title: `Could not terminate ${target.name}`, description: res.error })
      }
    } catch (err) {
      toast({ tone: 'danger', title: 'Termination failed', description: (err as Error).message })
    } finally {
      setKilling(false)
      setTarget(null)
    }
  }

  const selectedProc = rows.find((p) => p.pid === selected) ?? null

  return (
    <Card className="flex min-h-[560px] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, PID or path"
            className="h-8 w-full rounded-lg border border-border bg-surface-2 pr-3 pl-8 text-[13px] outline-none focus:border-accent"
          />
        </div>
        {data && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <Badge>{data.total} processes</Badge>
            {query && <Badge tone="accent">{rows.length} matches</Badge>}
            {totals && (
              <span className="tabular">
                Σ CPU {formatPercent(totals.cpu, 0)} · Σ RAM {formatBytes(totals.mem)}
              </span>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            <Switch checked={auto} onChange={setAuto} label="Auto refresh" />
            Auto refresh (3s)
          </label>
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw className={cx('h-3.5 w-3.5', loading && 'animate-spin')} />}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<Skull className="h-3.5 w-3.5" />}
            disabled={!selectedProc || selectedProc.protected}
            onClick={() => selectedProc && setTarget(selectedProc)}
          >
            End task
          </Button>
        </div>
      </div>

      {error ? (
        <EmptyState title="Could not read processes" description={error} action={<Button onClick={() => void refresh()}>Retry</Button>} />
      ) : !data ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Search />} title="No matching processes" description={`Nothing matches "${query}".`} />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="text-left text-[11px] text-faint">
                <Th label="Name" k="name" sort={sort} onSort={toggleSort} />
                <Th label="PID" k="pid" sort={sort} onSort={toggleSort} right className="w-20" />
                <Th label="CPU" k="cpu" sort={sort} onSort={toggleSort} right className="w-36" />
                <Th label="Memory" k="memRss" sort={sort} onSort={toggleSort} right className="w-36" />
                <th className="w-28 border-b border-border px-4 py-2 text-right font-normal">Started</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const isProtected = p.protected
                return (
                  <tr
                    key={p.pid}
                    onClick={() => setSelected(p.pid)}
                    onDoubleClick={() => !isProtected && setTarget(p)}
                    className={cx(
                      'group transition-colors',
                      selected === p.pid ? 'bg-accent-soft' : 'hover:bg-surface-2'
                    )}
                  >
                    <td className="max-w-0 border-b border-border px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate" title={p.path ?? p.name}>
                          {p.name}
                        </span>
                        {isProtected && <Badge className="h-4 text-[10px]">system</Badge>}
                      </div>
                    </td>
                    <td className="tabular border-b border-border px-4 py-1.5 text-right text-muted">{p.pid}</td>
                    <td className="border-b border-border px-4 py-1.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1 w-12 overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, p.cpu)}%` }} />
                        </div>
                        <span className={cx('tabular w-12 text-right', p.cpu >= 20 && 'text-warning')}>{formatPercent(p.cpu, 1)}</span>
                      </div>
                    </td>
                    <td className="tabular border-b border-border px-4 py-1.5 text-right">{formatBytes(p.memRss)}</td>
                    <td className="tabular border-b border-border px-4 py-1.5 text-right text-muted">
                      {p.started ? new Date(p.started).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={target !== null}
        danger
        loading={killing}
        title={`End ${target?.name}?`}
        description="Unsaved data in this program will be lost. BetterDesktop re-checks the process right before terminating it."
        confirmLabel="End task"
        onCancel={() => setTarget(null)}
        onConfirm={() => void kill()}
      >
        {target && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border bg-surface-2 p-3 text-xs">
            <dt className="text-faint">PID</dt>
            <dd className="tabular">{target.pid}</dd>
            <dt className="text-faint">Memory</dt>
            <dd className="tabular">{formatBytes(target.memRss)}</dd>
            <dt className="text-faint">Path</dt>
            <dd className="break-all" data-selectable>
              {target.path ?? '—'}
            </dd>
          </dl>
        )}
      </ConfirmDialog>
    </Card>
  )
}

function Th({
  label,
  k,
  sort,
  onSort,
  right,
  className
}: {
  label: string
  k: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (k: SortKey) => void
  right?: boolean
  className?: string
}): React.JSX.Element {
  const active = sort.key === k
  const Icon = sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={cx('border-b border-border px-4 py-2 font-normal', className)}>
      <button
        onClick={() => onSort(k)}
        className={cx('inline-flex items-center gap-1 hover:text-fg', right && 'w-full justify-end', active && 'text-fg')}
      >
        {label}
        {active && <Icon className="h-3 w-3" />}
      </button>
    </th>
  )
}
