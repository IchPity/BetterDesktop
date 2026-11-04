import { CircleDashed, Wrench } from 'lucide-react'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/controls'
import type { ModuleMeta } from '../registry'

/**
 * Honest placeholder for modules that are not implemented yet.
 * No fake buttons, no simulated data – just what will come and what it needs.
 */
export function PlannedModule({ module: m }: { module: ModuleMeta }): React.JSX.Element {
  const Icon = m.icon
  return (
    <Page>
      <PageHeader
        icon={<Icon />}
        title={m.label}
        description={m.description}
        actions={<Badge tone="warning">Not implemented yet · Phase {m.phase}</Badge>}
      />
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-7">
          <CardHeader icon={<CircleDashed />} title="Planned features" />
          <CardBody>
            <ul className="space-y-2.5">
              {m.planned?.features.map((f) => (
                <li key={f} className="flex gap-3 text-[13px]">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="text-muted">{f}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card className="col-span-12 lg:col-span-5">
          <CardHeader icon={<Wrench />} title="What it requires" />
          <CardBody>
            <ul className="space-y-2.5">
              {m.planned?.requirements.map((r) => (
                <li key={r} className="flex gap-3 text-[13px]">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
                  <span className="text-muted">{r}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </Page>
  )
}
