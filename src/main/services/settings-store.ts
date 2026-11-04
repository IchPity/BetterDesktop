import { app } from 'electron'
import { EventEmitter } from 'node:events'
import { promises as fs, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  applySettingsPatch,
  DEFAULT_SETTINGS,
  normalizeSettings,
  settingsSchema,
  type Settings,
  type SettingsPatch
} from '@shared/settings'

/**
 * Persistent settings stored as JSON in the user data directory.
 * - Reads synchronously once at startup (fast, tiny file).
 * - Writes are debounced and atomic (temp file + rename) so a crash can
 *   never leave a half-written settings file behind.
 */
export class SettingsStore extends EventEmitter {
  private settings: Settings
  private readonly file: string
  private writeTimer: NodeJS.Timeout | null = null
  private writing: Promise<void> = Promise.resolve()

  constructor() {
    super()
    this.file = join(app.getPath('userData'), 'settings.json')
    this.settings = this.load()
  }

  get(): Settings {
    return this.settings
  }

  update(patch: SettingsPatch): Settings {
    const next = applySettingsPatch(this.settings, patch)
    const parsed = settingsSchema.parse(next)
    this.settings = parsed
    this.scheduleWrite()
    this.emit('change', parsed)
    return parsed
  }

  reset(): Settings {
    this.settings = structuredClone(DEFAULT_SETTINGS)
    this.scheduleWrite()
    this.emit('change', this.settings)
    return this.settings
  }

  /** Flush pending writes (called on quit). */
  async flush(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
      await this.write()
    }
    await this.writing
  }

  private load(): Settings {
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8'))
      return normalizeSettings(raw)
    } catch {
      return structuredClone(DEFAULT_SETTINGS)
    }
  }

  private scheduleWrite(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      void this.write()
    }, 300)
  }

  private write(): Promise<void> {
    const data = JSON.stringify(this.settings, null, 2)
    this.writing = this.writing.then(async () => {
      const tmp = `${this.file}.tmp`
      try {
        await fs.writeFile(tmp, data, 'utf8')
        await fs.rename(tmp, this.file)
      } catch (err) {
        console.error('[settings] failed to write settings', err)
      }
    })
    return this.writing
  }
}
