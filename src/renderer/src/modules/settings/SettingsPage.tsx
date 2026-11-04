import { Activity, FolderOpen, Info, Laptop, Moon, Palette, Power, RotateCcw, Settings, Shield, Sun } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { ACCENTS, type AccentName, type SettingsPatch } from '@shared/settings'
import type { AppInfo } from '@shared/app'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, Field, Segmented, Slider, Switch } from '@/components/ui/controls'
import { ConfirmDialog } from '@/components/ui/Modal'
import { cx } from '@/lib/format'
import { useSettings, useSettingsValue } from '@/stores/settings'
import { toast } from '@/stores/ui'

export function SettingsPage(): React.JSX.Element {
  const s = useSettingsValue()
  const updateStore = useSettings((st) => st.update)
  const resetStore = useSettings((st) => st.reset)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  // Local slider state so dragging is smooth; persisted on release.
  const [scale, setScale] = useState(s.appearance.scale)
  const [interval, setIntervalMs] = useState(s.monitoring.intervalMs)
  const [history, setHistory] = useState(s.monitoring.historyLength)
  useEffect(() => setScale(s.appearance.scale), [s.appearance.scale])
  useEffect(() => setIntervalMs(s.monitoring.intervalMs), [s.monitoring.intervalMs])
  useEffect(() => setHistory(s.monitoring.historyLength), [s.monitoring.historyLength])

  useEffect(() => {
    window.bd.app.info().then(setInfo).catch(() => setInfo(null))
  }, [])

  const update = (patch: SettingsPatch): void => {
    updateStore(patch).catch((err: Error) => toast({ tone: 'danger', title: 'Could not save setting', description: err.message }))
  }

  return (
    <Page className="max-w-[920px]">
      <PageHeader icon={<Settings />} title="Settings" description="Preferences are saved automatically." />

      <div className="space-y-4">
        <Section icon={<Palette />} title="Appearance">
          <Field label="Theme">
            <Segmented
              layoutId="theme"
              value={s.appearance.theme}
              onChange={(theme) => update({ appearance: { theme } })}
              options={[
                { value: 'dark', label: <><Moon className="h-3.5 w-3.5" /> Dark</> },
                { value: 'light', label: <><Sun className="h-3.5 w-3.5" /> Light</> },
                { value: 'system', label: <><Laptop className="h-3.5 w-3.5" /> System</> }
              ]}
            />
          </Field>
          <Field label="Accent color">
            <div className="flex gap-2">
              {(Object.keys(ACCENTS) as AccentName[]).map((a) => (
                <button
                  key={a}
                  title={a}
                  onClick={() => update({ appearance: { accent: a } })}
                  className={cx(
                    'h-6 w-6 rounded-full transition-transform hover:scale-110',
                    s.appearance.accent === a && 'ring-2 ring-fg ring-offset-2 ring-offset-surface'
                  )}
                  style={{ background: ACCENTS[a] }}
                />
              ))}
            </div>
          </Field>
          <Field label="Interface scale" description="Zoom the whole interface.">
            <Slider
              value={scale}
              min={0.8}
              max={1.3}
              step={0.05}
              onChange={setScale}
              onCommit={(v) => update({ appearance: { scale: v } })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </Field>
          <Field label="Reduce motion" description="Disable most animations and transitions.">
            <Switch checked={s.appearance.reduceMotion} onChange={(v) => update({ appearance: { reduceMotion: v } })} />
          </Field>
          <Field label="Collapsed sidebar" description="Show icons only. Toggle anytime with Ctrl+B.">
            <Switch
              checked={s.appearance.sidebarCollapsed}
              onChange={(v) => update({ appearance: { sidebarCollapsed: v } })}
            />
          </Field>
        </Section>

        <Section icon={<Activity />} title="Monitoring & performance">
          <Field
            label="Update interval"
            description="How often live metrics are refreshed. Higher values use less CPU."
          >
            <Slider
              value={interval}
              min={500}
              max={10000}
              step={250}
              onChange={setIntervalMs}
              onCommit={(v) => update({ monitoring: { intervalMs: v } })}
              format={(v) => `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 2)} s`}
            />
          </Field>
          <Field label="History length" description="Number of samples kept for charts.">
            <Slider
              value={history}
              min={30}
              max={600}
              step={10}
              onChange={setHistory}
              onCommit={(v) => update({ monitoring: { historyLength: v } })}
              format={(v) => `${v}`}
            />
          </Field>
          <Field label="Pause when minimized" description="Stop polling while the window is minimized or hidden.">
            <Switch
              checked={s.monitoring.pauseWhenHidden}
              onChange={(v) => update({ monitoring: { pauseWhenHidden: v } })}
            />
          </Field>
        </Section>

        <Section icon={<Power />} title="Startup">
          <Field
            label="Launch at login"
            description={
              <>
                Start BetterDesktop when you sign in to Windows.{' '}
                <span className="text-faint">Only takes effect in the installed app, not in development mode.</span>
              </>
            }
          >
            <Switch checked={s.startup.launchAtLogin} onChange={(v) => update({ startup: { launchAtLogin: v } })} />
          </Field>
          <Field label="Start minimized">
            <Switch checked={s.startup.startMinimized} onChange={(v) => update({ startup: { startMinimized: v } })} />
          </Field>
        </Section>

        <Section icon={<Shield />} title="Data & privacy">
          <Field
            label="Local data only"
            description="BetterDesktop stores everything on this PC. Nothing is sent to any server."
          >
            <Badge tone="success">Offline</Badge>
          </Field>
          <Field label="Data folder" description={<span data-selectable>{info?.userDataPath ?? '…'}</span>}>
            <Button
              size="sm"
              icon={<FolderOpen className="h-3.5 w-3.5" />}
              onClick={async () => {
                const res = await window.bd.app.openDataFolder()
                if (!res.ok) toast({ tone: 'danger', title: 'Could not open folder', description: res.error })
              }}
            >
              Open
            </Button>
          </Field>
          <Field label="Reset all settings" description="Restores defaults, including dashboard layouts.">
            <Button size="sm" variant="outline" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setConfirmReset(true)}>
              Reset
            </Button>
          </Field>
        </Section>

        <Section icon={<Info />} title="About">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 py-2 text-xs sm:grid-cols-4">
            <AboutItem label="Version" value={info?.version} />
            <AboutItem label="Electron" value={info?.electron} />
            <AboutItem label="Chromium" value={info?.chrome} />
            <AboutItem label="Node.js" value={info?.node} />
          </div>
          <p className="pb-2 text-xs text-faint">BetterDesktop — One App. Your Entire PC.</p>
        </Section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        danger
        title="Reset all settings?"
        description="All preferences and dashboard layouts will be restored to their defaults."
        confirmLabel="Reset"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          void resetStore().then(() => toast({ tone: 'success', title: 'Settings reset' }))
          setConfirmReset(false)
        }}
      />
    </Page>
  )
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }): React.JSX.Element {
  return (
    <Card>
      <CardHeader icon={icon} title={title} />
      <CardBody className="pb-1">{children}</CardBody>
    </Card>
  )
}

function AboutItem({ label, value }: { label: string; value?: string }): React.JSX.Element {
  return (
    <div>
      <div className="text-faint">{label}</div>
      <div className="tabular" data-selectable>
        {value ?? '…'}
      </div>
    </div>
  )
}
