import { create } from 'zustand'
import type { Settings, SettingsPatch } from '@shared/settings'

interface SettingsState {
  settings: Settings | null
  error: string | null
  load: () => Promise<void>
  update: (patch: SettingsPatch) => Promise<void>
  reset: () => Promise<void>
}

export const useSettings = create<SettingsState>((set) => ({
  settings: null,
  error: null,
  load: async () => {
    try {
      const settings = await window.bd.settings.get()
      set({ settings, error: null })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },
  update: async (patch) => {
    try {
      const settings = await window.bd.settings.update(patch)
      set({ settings, error: null })
    } catch (err) {
      set({ error: (err as Error).message })
      throw err
    }
  },
  reset: async () => {
    const settings = await window.bd.settings.reset()
    set({ settings })
  }
}))

// Keep in sync with changes coming from the main process.
window.bd.settings.onChange((settings) => useSettings.setState({ settings }))

/** Convenience hook: settings are guaranteed loaded once the app shell renders. */
export function useSettingsValue(): Settings {
  const s = useSettings((st) => st.settings)
  if (!s) throw new Error('Settings not loaded yet')
  return s
}
