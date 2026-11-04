import { AlarmClock, Eye, EyeOff, Focus, Gauge, Hand, LocateFixed, Moon, PawPrint, Sparkles, Sun, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  ACCENTS,
  PET_CHARACTERS,
  type PetCharacter,
  type PetPersonality,
  type SettingsPatch
} from '@shared/settings'
import { PET_TIMER_MINUTES, type PetCommand, type PetState, type PetStatus } from '@shared/pet'
import { Page, PageHeader } from '@/components/layout/Page'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, Field, Segmented, Slider, Switch } from '@/components/ui/controls'
import { PetSprite } from '@/components/pet/PetSprite'
import { cx } from '@/lib/format'
import { useSettings, useSettingsValue } from '@/stores/settings'
import { toast } from '@/stores/ui'

const CHARACTER_LABEL: Record<PetCharacter, string> = { blob: 'Blob', cat: 'Cat', bot: 'Bot' }

const PERSONALITY: Record<PetPersonality, string> = {
  calm: 'Wanders now and then, naps occasionally.',
  playful: 'Always on the move and jumps around.',
  sleepy: 'Spends most of the day dozing.'
}

const STATE_LABEL: Record<PetState, string> = {
  idle: 'Relaxing',
  walk: 'Walking',
  sleep: 'Sleeping',
  happy: 'Happy',
  alert: 'Wants your attention',
  drag: 'Being carried',
  fall: 'Falling'
}

function usePetStatus(): PetStatus | null {
  const [status, setStatus] = useState<PetStatus | null>(null)
  useEffect(() => {
    const off = window.bd.pet.onStatus(setStatus)
    window.bd.pet.status().then(setStatus).catch(() => setStatus(null))
    return off
  }, [])
  return status
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function DesktopPet(): React.JSX.Element {
  const s = useSettingsValue()
  const updateStore = useSettings((st) => st.update)
  const pet = s.pet
  const status = usePetStatus()
  const now = useNow(!!status?.timer)
  const accent = ACCENTS[s.appearance.accent]

  const [size, setSize] = useState(pet.size)
  const [cpu, setCpu] = useState(pet.cpuThreshold)
  const [ram, setRam] = useState(pet.ramThreshold)
  useEffect(() => setSize(pet.size), [pet.size])
  useEffect(() => setCpu(pet.cpuThreshold), [pet.cpuThreshold])
  useEffect(() => setRam(pet.ramThreshold), [pet.ramThreshold])

  // Clicking the preview makes it happy for a moment.
  const [previewHappy, setPreviewHappy] = useState(false)
  useEffect(() => {
    if (!previewHappy) return
    const t = setTimeout(() => setPreviewHappy(false), 1600)
    return () => clearTimeout(t)
  }, [previewHappy])

  const update = (patch: SettingsPatch): void => {
    updateStore(patch).catch((err: Error) => toast({ tone: 'danger', title: 'Could not save setting', description: err.message }))
  }
  const command = (cmd: PetCommand): void => {
    window.bd.pet.command(cmd).catch((err: Error) => toast({ tone: 'danger', title: 'Pet command failed', description: err.message }))
  }

  const visible = status?.visible ?? false
  const liveState: PetState = visible && status ? status.state : 'idle'
  const previewState: PetState = previewHappy ? 'happy' : liveState

  return (
    <Page className="max-w-[1100px]">
      <PageHeader
        icon={<PawPrint />}
        title="Desktop Pet"
        description="A small companion that lives on top of your taskbar."
        actions={
          <Button
            variant={pet.enabled ? 'secondary' : 'primary'}
            icon={pet.enabled ? <EyeOff /> : <Eye />}
            onClick={() => update({ pet: { enabled: !pet.enabled } })}
          >
            {pet.enabled ? 'Hide from desktop' : 'Show on desktop'}
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        {/* ---- stage ---- */}
        <Card className="col-span-12 lg:col-span-5">
          <CardHeader
            icon={<Sparkles />}
            title="Your pet"
            subtitle={visible ? STATE_LABEL[liveState] : 'Not on the desktop'}
            actions={visible ? <Badge tone="success">On desktop</Badge> : <Badge>Hidden</Badge>}
          />
          <CardBody>
            <button
              type="button"
              onClick={() => setPreviewHappy(true)}
              className="relative flex h-52 w-full items-end justify-center overflow-hidden rounded-xl border border-border bg-surface-2"
              title="Click to pet"
            >
              <div className="absolute inset-x-0 bottom-0 h-5 border-t border-border bg-surface-3" />
              <div className="relative mb-4">
                <PetSprite
                  character={pet.character}
                  state={previewState}
                  accent={accent}
                  size={Math.round(120 * Math.min(pet.size, 1.3))}
                  reduceMotion={s.appearance.reduceMotion}
                />
              </div>
            </button>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" icon={<LocateFixed />} disabled={!visible} onClick={() => command({ type: 'reset-position' })}>
                Bring back
              </Button>
              {liveState === 'sleep' ? (
                <Button size="sm" icon={<Sun />} disabled={!visible} onClick={() => command({ type: 'wake' })}>
                  Wake up
                </Button>
              ) : (
                <Button size="sm" icon={<Moon />} disabled={!visible} onClick={() => command({ type: 'sleep' })}>
                  Go to sleep
                </Button>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <AlarmClock className="h-4 w-4 text-accent" />
                Timer
                {status?.timer && (
                  <span className="tabular ml-auto flex items-center gap-2 text-muted">
                    {formatCountdown(status.timer.endsAt - now)} left
                    <Button size="icon-sm" variant="ghost" title="Cancel timer" onClick={() => command({ type: 'cancel-timer' })}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted">
                {visible ? 'Your pet lets you know when the time is up.' : 'Runs in the background and notifies you when done.'}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {PET_TIMER_MINUTES.map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={status?.timer?.minutes === m ? 'primary' : 'outline'}
                    onClick={() => command({ type: 'timer', minutes: m })}
                  >
                    {m} min
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-muted">
              <Hint icon={<Hand />}>Click to pet · drag to carry it anywhere</Hint>
              <Hint icon={<PawPrint />}>Double-click opens BetterDesktop · right-click for the menu</Hint>
            </div>
          </CardBody>
        </Card>

        {/* ---- settings ---- */}
        <div className="col-span-12 space-y-4 lg:col-span-7">
          <Card>
            <CardHeader icon={<PawPrint />} title="Character" />
            <CardBody>
              <div className="grid grid-cols-3 gap-2">
                {PET_CHARACTERS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update({ pet: { character: c } })}
                    className={cx(
                      'flex flex-col items-center gap-1 rounded-xl border py-3 transition-colors',
                      pet.character === c
                        ? 'border-accent bg-accent-soft'
                        : 'border-border bg-surface-2 hover:border-border-strong'
                    )}
                  >
                    <PetSprite character={c} state="idle" accent={accent} size={56} reduceMotion={s.appearance.reduceMotion} />
                    <span className="text-xs font-medium">{CHARACTER_LABEL[c]}</span>
                  </button>
                ))}
              </div>
              <div className="mt-1">
                <Field label="Personality" description={PERSONALITY[pet.personality]}>
                  <Segmented<PetPersonality>
                    layoutId="pet-personality"
                    value={pet.personality}
                    onChange={(personality) => update({ pet: { personality } })}
                    options={[
                      { value: 'calm', label: 'Calm' },
                      { value: 'playful', label: 'Playful' },
                      { value: 'sleepy', label: 'Sleepy' }
                    ]}
                  />
                </Field>
                <Field label="Size">
                  <Slider
                    value={size}
                    min={0.6}
                    max={1.6}
                    step={0.1}
                    onChange={setSize}
                    onCommit={(v) => update({ pet: { size: v } })}
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Focus />} title="Behaviour" />
            <CardBody className="pb-1">
              <Field label="Focus mode" description="Almost invisible, stays in place and only speaks up for timers and warnings.">
                <Switch checked={pet.focusMode} onChange={(v) => update({ pet: { focusMode: v } })} />
              </Field>
              <Field label="Sleep when you are away" description="Falls asleep after 5 minutes without keyboard or mouse input.">
                <Switch checked={pet.sleepWhenIdle} onChange={(v) => update({ pet: { sleepWhenIdle: v } })} />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Gauge />} title="Resource warnings" subtitle="Checked every 5 seconds while the pet is on the desktop." />
            <CardBody className="pb-1">
              <Field label="Warn about high usage" description="The pet tells you when a value stays above its limit for 15 seconds (at most every 10 minutes).">
                <Switch checked={pet.resourceWarnings} onChange={(v) => update({ pet: { resourceWarnings: v } })} />
              </Field>
              <Field label="CPU limit">
                <Slider
                  value={cpu}
                  min={50}
                  max={100}
                  step={5}
                  onChange={setCpu}
                  onCommit={(v) => update({ pet: { cpuThreshold: v } })}
                  format={(v) => `${v}%`}
                />
              </Field>
              <Field label="Memory limit">
                <Slider
                  value={ram}
                  min={50}
                  max={100}
                  step={5}
                  onChange={setRam}
                  onCommit={(v) => update({ pet: { ramThreshold: v } })}
                  format={(v) => `${v}%`}
                />
              </Field>
            </CardBody>
          </Card>
        </div>
      </div>
    </Page>
  )
}

function Hint({ icon, children }: { icon: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-faint">
      {icon}
      {children}
    </div>
  )
}
