import { BrowserWindow, Menu, Notification, powerMonitor, screen, type Rectangle, type WebContents } from 'electron'
import os from 'node:os'
import { join } from 'node:path'
import { ACCENTS, type PetPersonality, type Settings } from '@shared/settings'
import { IPC } from '@shared/ipc'
import { PET_TIMER_MINUTES, type PetBubble, type PetCommand, type PetState, type PetStatus, type PetView } from '@shared/pet'

const BASE_SPRITE = 96
/** Room above the sprite for speech bubbles. */
const BUBBLE_SPACE = 72
const WALK_FPS = 30
const DRAG_FPS = 60
const WATCH_MS = 5000
const IDLE_SLEEP_SECONDS = 300
const WARNING_COOLDOWN_MS = 10 * 60_000
/** Consecutive watch samples above the threshold before warning (3 × 5 s). */
const WARNING_SAMPLES = 3

interface Temperament {
  weights: { idle: number; walk: number; sleep: number; happy: number }
  idleMs: [number, number]
  sleepMs: [number, number]
  /** Walking speed in px per second at size 1. */
  speed: number
}

const TEMPERAMENT: Record<PetPersonality, Temperament> = {
  calm: { weights: { idle: 0.55, walk: 0.35, sleep: 0.1, happy: 0 }, idleMs: [4000, 9000], sleepMs: [20_000, 45_000], speed: 34 },
  playful: { weights: { idle: 0.3, walk: 0.55, sleep: 0, happy: 0.15 }, idleMs: [2000, 5000], sleepMs: [10_000, 20_000], speed: 62 },
  sleepy: { weights: { idle: 0.4, walk: 0.2, sleep: 0.4, happy: 0 }, idleMs: [5000, 12_000], sleepMs: [30_000, 90_000], speed: 24 }
}

const POKE_LINES = [
  'Hi there!',
  'Hehe, that tickles.',
  'Time to stretch a little?',
  'Have you had some water today?',
  'I like it here.',
  'Back to work!'
]

const rand = (min: number, max: number): number => min + Math.random() * (max - min)
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

export interface PetControllerOptions {
  rendererUrl: string | undefined
  /** Bring the main window to the front, optionally opening a module. */
  showApp: (module?: string) => void
  /** Persist a settings change (e.g. "Hide pet" from the context menu). */
  updateSettings: (patch: { pet: Partial<Settings['pet']> }) => void
  /** Windows that should receive pet status updates (the app window). */
  statusTargets: () => WebContents[]
}

/**
 * Owns the Desktop Pet: a small transparent, always-on-top, click-through
 * window plus its behaviour (wandering, sleeping, dragging, falling).
 *
 * All movement happens here by moving the window. Timers only run while they
 * are needed: the walk/drag frame loop exists only while moving, and the
 * watch loop (idle detection + CPU/RAM check) costs one os.cpus() call every
 * five seconds – no extra processes.
 */
export class PetController {
  private win: BrowserWindow | null = null
  private settings: Settings

  private state: PetState = 'idle'
  private facing: 'left' | 'right' = 'left'
  private bubble: PetBubble | null = null
  private bubbleTimer: NodeJS.Timeout | null = null

  private x = 0
  private y = 0
  private vy = 0
  private targetX = 0
  private dragOffset = { x: 0, y: 0 }
  private interactive = false

  private frameTimer: NodeJS.Timeout | null = null
  private decideTimer: NodeJS.Timeout | null = null
  private watchTimer: NodeJS.Timeout | null = null

  /** Sleep requested by the user – stays asleep until woken. */
  private manualSleep = false
  /** Asleep because the PC is idle – wakes when input resumes. */
  private idleSleep = false

  private timer: { endsAt: number; minutes: number; handle: NodeJS.Timeout } | null = null

  private prevCpu: { idle: number; total: number } | null = null
  private lastCpu: number | null = null
  private lastRam: number | null = null
  private overCount = { cpu: 0, ram: 0 }
  private warnedAt = { cpu: 0, ram: 0 }

  private readonly onDisplaysChanged = (): void => this.snapToDisplay()

  constructor(
    settings: Settings,
    private readonly opts: PetControllerOptions
  ) {
    this.settings = settings
  }

  /** Is this the pet window's renderer? Pet IPC calls are only accepted from it. */
  owns(wc: WebContents): boolean {
    return !!this.win && !this.win.isDestroyed() && this.win.webContents.id === wc.id
  }

  isPetWindow(win: BrowserWindow): boolean {
    return this.win === win
  }

  applySettings(next: Settings): void {
    const prev = this.settings
    this.settings = next
    const pet = next.pet
    if (!pet.enabled) {
      this.close()
      return
    }
    if (!this.win) {
      this.open()
      return
    }
    if (pet.size !== prev.pet.size) this.resize()
    if (pet.focusMode && !prev.pet.focusMode) {
      // Settle down: stop walking, drop chatty bubbles.
      if (this.state === 'walk') this.setState('idle')
      if (this.bubble?.tone === 'info' && !this.timer) this.clearBubble()
      this.schedule(1000)
    }
    if (!pet.resourceWarnings) this.overCount = { cpu: 0, ram: 0 }
    this.pushView()
  }

  status(): PetStatus {
    return {
      visible: !!this.win,
      state: this.state,
      timer: this.timer ? { endsAt: this.timer.endsAt, minutes: this.timer.minutes } : null
    }
  }

  view(): PetView {
    const s = this.settings
    return {
      character: s.pet.character,
      spriteSize: this.spriteSize(),
      accent: ACCENTS[s.appearance.accent],
      state: this.state,
      facing: this.facing,
      bubble: this.bubble,
      focusMode: s.pet.focusMode,
      reduceMotion: s.appearance.reduceMotion
    }
  }

  command(cmd: PetCommand): void {
    switch (cmd.type) {
      case 'reset-position':
        if (!this.win) return
        this.placeHome()
        this.setState('idle')
        this.schedule(2000)
        return
      case 'sleep':
        this.goToSleep(true)
        return
      case 'wake':
        this.wake()
        return
      case 'timer':
        this.startTimer(cmd.minutes)
        return
      case 'cancel-timer':
        this.cancelTimer()
        return
    }
  }

  // ---- calls from the pet window ------------------------------------------

  setInteractive(on: boolean): void {
    if (!this.win || on === this.interactive) return
    this.interactive = on
    this.win.setIgnoreMouseEvents(!on, { forward: true })
  }

  poke(): void {
    if (!this.win || this.state === 'drag' || this.state === 'fall') return
    if (this.bubble && (this.state === 'alert' || this.bubble.tone === 'warning')) {
      this.clearBubble()
      this.setState('idle')
      this.schedule(3000)
      return
    }
    if (this.state === 'sleep') {
      this.wake()
      return
    }
    this.setState('happy')
    if (!this.settings.pet.focusMode) {
      const stats =
        this.lastCpu !== null && this.lastRam !== null && Math.random() < 0.35
          ? `CPU ${Math.round(this.lastCpu)}% · RAM ${Math.round(this.lastRam)}%`
          : null
      this.say(stats ?? pick(POKE_LINES), 'info', 3500)
    }
    this.schedule(1600)
  }

  dragStart(): void {
    if (!this.win) return
    this.manualSleep = false
    this.idleSleep = false
    const c = screen.getCursorScreenPoint()
    this.dragOffset = { x: c.x - this.x, y: c.y - this.y }
    this.stopFrames()
    this.setState('drag')
    this.clearDecision()
    let lastX = this.x
    this.frameTimer = setInterval(() => {
      const p = screen.getCursorScreenPoint()
      this.x = p.x - this.dragOffset.x
      this.y = p.y - this.dragOffset.y
      if (Math.abs(this.x - lastX) > 2) {
        const facing = this.x > lastX ? 'right' : 'left'
        if (facing !== this.facing) {
          this.facing = facing
          this.pushView()
        }
        lastX = this.x
      }
      this.applyBounds()
    }, 1000 / DRAG_FPS)
  }

  dragEnd(): void {
    if (!this.win || this.state !== 'drag') return
    this.stopFrames()
    const area = this.area()
    this.x = Math.min(Math.max(this.x, area.x), area.x + area.width - this.winSize().width)
    this.applyBounds()
    if (this.y < this.ground() - 1) this.fall()
    else this.land()
  }

  showMenu(): void {
    const win = this.win
    if (!win) return
    const pet = this.settings.pet
    const asleep = this.state === 'sleep'
    const menu = Menu.buildFromTemplate([
      { label: 'Open BetterDesktop', click: () => this.opts.showApp() },
      { type: 'separator' },
      asleep
        ? { label: 'Wake up', click: () => this.wake() }
        : { label: 'Go to sleep', click: () => this.goToSleep(true) },
      {
        label: 'Timer',
        submenu: [
          ...PET_TIMER_MINUTES.map((m) => ({ label: `${m} minutes`, click: () => this.startTimer(m) })),
          { type: 'separator' as const },
          { label: 'Cancel timer', enabled: !!this.timer, click: () => this.cancelTimer() }
        ]
      },
      {
        label: 'Focus mode',
        type: 'checkbox',
        checked: pet.focusMode,
        click: () => this.opts.updateSettings({ pet: { focusMode: !pet.focusMode } })
      },
      { type: 'separator' },
      { label: 'Pet settings…', click: () => this.opts.showApp('pet') },
      { label: 'Hide pet', click: () => this.opts.updateSettings({ pet: { enabled: false } }) }
    ])
    menu.popup({ window: win })
  }

  openApp(): void {
    this.opts.showApp()
  }

  dismissBubble(): void {
    this.clearBubble()
    if (this.state === 'alert') {
      this.setState('idle')
      this.schedule(3000)
    }
  }

  dispose(): void {
    this.cancelTimer(false)
    this.close()
  }

  // ---- window --------------------------------------------------------------

  private open(): void {
    const { width, height } = this.winSize()
    const win = new BrowserWindow({
      width,
      height,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      alwaysOnTop: true,
      title: 'BetterDesktop Pet',
      webPreferences: {
        preload: join(__dirname, '../preload/pet.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        spellcheck: false,
        devTools: !!this.opts.rendererUrl,
        // Keep animating smoothly even though the window never has focus.
        backgroundThrottling: false
      }
    })
    this.win = win
    this.interactive = false
    this.state = 'idle'
    this.placeHome()

    win.setIgnoreMouseEvents(true, { forward: true })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (e) => e.preventDefault())
    win.once('ready-to-show', () => {
      if (win.isDestroyed()) return
      win.showInactive()
      this.schedule(2500)
    })
    win.on('closed', () => {
      if (this.win === win) this.teardown()
    })

    if (this.opts.rendererUrl) void win.loadURL(`${this.opts.rendererUrl}/pet.html`)
    else void win.loadFile(join(__dirname, '../renderer/pet.html'))

    screen.on('display-metrics-changed', this.onDisplaysChanged)
    screen.on('display-removed', this.onDisplaysChanged)
    this.startWatch()
    this.pushStatus()
  }

  private close(): void {
    const win = this.win
    if (!win) return
    this.teardown()
    if (!win.isDestroyed()) win.destroy()
  }

  private teardown(): void {
    this.win = null
    this.stopFrames()
    this.clearDecision()
    this.clearBubble(false)
    if (this.watchTimer) clearInterval(this.watchTimer)
    this.watchTimer = null
    this.manualSleep = false
    this.idleSleep = false
    this.prevCpu = null
    screen.off('display-metrics-changed', this.onDisplaysChanged)
    screen.off('display-removed', this.onDisplaysChanged)
    this.pushStatus()
  }

  private spriteSize(): number {
    return Math.round(BASE_SPRITE * this.settings.pet.size)
  }

  private winSize(): { width: number; height: number } {
    const sprite = this.spriteSize()
    return { width: Math.max(220, sprite + 40), height: sprite + BUBBLE_SPACE }
  }

  private area(): Rectangle {
    const { width, height } = this.winSize()
    return screen.getDisplayMatching({ x: Math.round(this.x), y: Math.round(this.y), width, height }).workArea
  }

  /** Window y at which the pet stands on the bottom of the work area (taskbar). */
  private ground(): number {
    const area = this.area()
    return area.y + area.height - this.winSize().height
  }

  private placeHome(): void {
    const area = screen.getPrimaryDisplay().workArea
    const { width, height } = this.winSize()
    this.x = area.x + area.width - width - 80
    this.y = area.y + area.height - height
    this.applyBounds()
  }

  private snapToDisplay(): void {
    if (!this.win) return
    const area = this.area()
    const { width } = this.winSize()
    this.x = Math.min(Math.max(this.x, area.x), area.x + area.width - width)
    if (this.state !== 'drag') this.y = this.ground()
    this.applyBounds()
  }

  private resize(): void {
    // keep the feet where they are
    const bottom = this.y + (this.win?.getBounds().height ?? 0)
    this.y = bottom - this.winSize().height
    this.snapToDisplay()
  }

  private applyBounds(): void {
    if (!this.win || this.win.isDestroyed()) return
    const { width, height } = this.winSize()
    // setBounds (not setPosition) so mixed-DPI monitors cannot change the size.
    this.win.setBounds({ x: Math.round(this.x), y: Math.round(this.y), width, height })
  }

  // ---- behaviour -----------------------------------------------------------

  private setState(state: PetState): void {
    if (state !== 'drag' && state !== 'fall' && state !== 'walk') this.stopFrames()
    if (this.state === state) return
    this.state = state
    this.pushView()
    this.pushStatus()
  }

  private schedule(ms: number): void {
    this.clearDecision()
    if (!this.win) return
    this.decideTimer = setTimeout(() => this.decide(), ms)
  }

  private clearDecision(): void {
    if (this.decideTimer) clearTimeout(this.decideTimer)
    this.decideTimer = null
  }

  private stopFrames(): void {
    if (this.frameTimer) clearInterval(this.frameTimer)
    this.frameTimer = null
  }

  private decide(): void {
    if (!this.win || this.state === 'drag' || this.state === 'fall') return
    if (this.manualSleep || this.idleSleep) return
    if (this.state === 'alert' && this.bubble) {
      this.schedule(5000)
      return
    }
    const t = TEMPERAMENT[this.settings.pet.personality]

    // Focus mode: stay put and mostly doze.
    if (this.settings.pet.focusMode) {
      this.setState(Math.random() < 0.5 ? 'sleep' : 'idle')
      this.schedule(rand(15_000, 30_000))
      return
    }

    const w = t.weights
    let r = Math.random() * (w.idle + w.walk + w.sleep + w.happy)
    if ((r -= w.walk) < 0 && this.walk(t)) return
    if ((r -= w.sleep) < 0 && this.state !== 'sleep') {
      this.setState('sleep')
      this.schedule(rand(...t.sleepMs))
      return
    }
    if ((r -= w.happy) < 0 && w.happy > 0) {
      this.setState('happy')
      this.schedule(1600)
      return
    }
    this.setState('idle')
    this.schedule(rand(...t.idleMs))
  }

  /** Start walking to a random spot on the current screen. False if too close. */
  private walk(t: Temperament): boolean {
    const area = this.area()
    const { width } = this.winSize()
    const min = area.x
    const max = area.x + area.width - width
    if (max <= min) return false
    this.targetX = rand(min, max)
    if (Math.abs(this.targetX - this.x) < 60) return false

    this.facing = this.targetX > this.x ? 'right' : 'left'
    this.y = this.ground()
    this.setState('walk')
    this.pushView()
    const step = (t.speed * Math.max(0.7, this.settings.pet.size)) / WALK_FPS
    this.stopFrames()
    this.frameTimer = setInterval(() => {
      const dx = this.targetX - this.x
      if (Math.abs(dx) <= step) {
        this.x = this.targetX
        this.applyBounds()
        this.setState('idle')
        this.schedule(rand(...t.idleMs))
        return
      }
      this.x += Math.sign(dx) * step
      this.applyBounds()
    }, 1000 / WALK_FPS)
    return true
  }

  private fall(): void {
    this.setState('fall')
    this.vy = 0
    this.stopFrames()
    this.frameTimer = setInterval(() => {
      const ground = this.ground()
      this.vy = Math.min(this.vy + 1.6, 40)
      this.y += this.vy
      if (this.y >= ground) {
        this.y = ground
        this.applyBounds()
        this.land()
        return
      }
      this.applyBounds()
    }, 1000 / DRAG_FPS)
  }

  private land(): void {
    this.stopFrames()
    this.y = this.ground()
    this.applyBounds()
    this.setState('happy')
    this.schedule(1400)
  }

  private goToSleep(manual: boolean): void {
    if (!this.win || this.state === 'drag' || this.state === 'fall') return
    this.manualSleep = manual
    this.idleSleep = !manual
    this.clearDecision()
    if (this.bubble?.tone === 'info') this.clearBubble()
    this.setState('sleep')
  }

  private wake(): void {
    if (!this.win) return
    const wasAsleep = this.state === 'sleep'
    this.manualSleep = false
    this.idleSleep = false
    this.setState('idle')
    if (wasAsleep && !this.settings.pet.focusMode) this.say('*yawn* Good morning!', 'info', 3000)
    this.schedule(3000)
  }

  // ---- speech bubble -------------------------------------------------------

  private say(text: string, tone: PetBubble['tone'], ms: number | null): void {
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer)
    this.bubbleTimer = null
    this.bubble = { text, tone }
    if (ms) this.bubbleTimer = setTimeout(() => this.clearBubble(), ms)
    this.pushView()
  }

  private clearBubble(push = true): void {
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer)
    this.bubbleTimer = null
    if (!this.bubble) return
    this.bubble = null
    if (push) this.pushView()
  }

  private alert(text: string): void {
    if (!this.win) return
    this.manualSleep = false
    this.idleSleep = false
    if (this.state === 'drag') {
      this.say(text, 'warning', null)
      return
    }
    this.clearDecision()
    this.setState('alert')
    this.say(text, 'warning', null)
    // Calm down after a while, the bubble stays until clicked.
    this.schedule(8000)
  }

  // ---- timer ---------------------------------------------------------------

  private startTimer(minutes: number): void {
    this.cancelTimer(false)
    const endsAt = Date.now() + minutes * 60_000
    const handle = setTimeout(() => this.timerDone(minutes), minutes * 60_000)
    this.timer = { endsAt, minutes, handle }
    if (this.win) this.say(`Timer set: ${minutes} min`, 'info', 2500)
    this.pushStatus()
  }

  private cancelTimer(push = true): void {
    if (!this.timer) return
    clearTimeout(this.timer.handle)
    this.timer = null
    if (push) this.pushStatus()
  }

  private timerDone(minutes: number): void {
    this.timer = null
    const text = `Time's up! (${minutes} min timer)`
    this.alert(text)
    if (this.settings.notifications.enabled && Notification.isSupported()) {
      new Notification({ title: 'BetterDesktop', body: text, silent: false }).show()
    }
    this.pushStatus()
  }

  // ---- watch loop: idle detection + resource warnings ----------------------

  private startWatch(): void {
    this.sampleCpu() // prime
    this.watchTimer = setInterval(() => this.watch(), WATCH_MS)
  }

  private watch(): void {
    if (!this.win) return
    const pet = this.settings.pet

    if (pet.sleepWhenIdle) {
      const idle = powerMonitor.getSystemIdleTime()
      if (idle >= IDLE_SLEEP_SECONDS && !this.idleSleep && !this.manualSleep && this.state !== 'alert') {
        this.goToSleep(false)
      } else if (this.idleSleep && idle < 5) {
        this.wake()
      }
    } else if (this.idleSleep) {
      this.wake()
    }

    const cpu = this.sampleCpu()
    const total = os.totalmem()
    const ram = total > 0 ? ((total - os.freemem()) / total) * 100 : null
    this.lastCpu = cpu
    this.lastRam = ram
    if (!pet.resourceWarnings) return

    this.checkThreshold('cpu', cpu, pet.cpuThreshold, (v) => `CPU has been at ${Math.round(v)}% for a while.`)
    this.checkThreshold('ram', ram, pet.ramThreshold, (v) => `Memory is ${Math.round(v)}% full.`)
  }

  private checkThreshold(key: 'cpu' | 'ram', value: number | null, threshold: number, message: (v: number) => string): void {
    if (value === null || value < threshold) {
      this.overCount[key] = 0
      return
    }
    this.overCount[key]++
    const now = Date.now()
    if (this.overCount[key] >= WARNING_SAMPLES && now - this.warnedAt[key] > WARNING_COOLDOWN_MS) {
      this.warnedAt[key] = now
      this.alert(message(value))
    }
  }

  /** Whole-machine CPU load since the previous call (os.cpus deltas, no process). */
  private sampleCpu(): number | null {
    let idle = 0
    let total = 0
    for (const c of os.cpus()) {
      const t = c.times
      idle += t.idle
      total += t.user + t.nice + t.sys + t.idle + t.irq
    }
    const prev = this.prevCpu
    this.prevCpu = { idle, total }
    if (!prev || total <= prev.total) return null
    return Math.max(0, Math.min(100, (1 - (idle - prev.idle) / (total - prev.total)) * 100))
  }

  // ---- push ----------------------------------------------------------------

  private pushView(): void {
    const wc = this.win?.webContents
    if (wc && !wc.isDestroyed()) wc.send(IPC.petViewChanged, this.view())
  }

  private pushStatus(): void {
    const status = this.status()
    for (const wc of this.opts.statusTargets()) {
      if (!wc.isDestroyed()) wc.send(IPC.petStatusChanged, status)
    }
  }
}
