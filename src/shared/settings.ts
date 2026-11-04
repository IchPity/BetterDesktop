import { z } from 'zod'

/** Every widget the dashboard knows about. */
export const WIDGET_TYPES = [
  'cpu',
  'memory',
  'gpu',
  'storage',
  'network',
  'processes',
  'system-info',
  'quick-actions',
  'cpu-cores'
] as const
export type WidgetType = (typeof WIDGET_TYPES)[number]

export const WIDGET_SIZES = ['sm', 'md', 'lg', 'xl'] as const
export type WidgetSize = (typeof WIDGET_SIZES)[number]

const widgetSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(WIDGET_TYPES),
  size: z.enum(WIDGET_SIZES)
})
export type WidgetInstance = z.infer<typeof widgetSchema>

const layoutSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(48),
  widgets: z.array(widgetSchema).max(40)
})
export type DashboardLayout = z.infer<typeof layoutSchema>

export const ACCENTS = {
  indigo: '#6d7cff',
  violet: '#9a7bff',
  blue: '#3b9eff',
  teal: '#2fc7b5',
  emerald: '#3ccf8e',
  amber: '#f5b041',
  rose: '#f2668b'
} as const
export type AccentName = keyof typeof ACCENTS

export const DEFAULT_WIDGETS: WidgetInstance[] = [
  { id: 'w-cpu', type: 'cpu', size: 'md' },
  { id: 'w-mem', type: 'memory', size: 'md' },
  { id: 'w-net', type: 'network', size: 'md' },
  { id: 'w-gpu', type: 'gpu', size: 'md' },
  { id: 'w-cores', type: 'cpu-cores', size: 'lg' },
  { id: 'w-storage', type: 'storage', size: 'md' },
  { id: 'w-proc', type: 'processes', size: 'lg' },
  { id: 'w-sys', type: 'system-info', size: 'md' },
  { id: 'w-quick', type: 'quick-actions', size: 'md' }
]

export const DEFAULT_LAYOUT_ID = 'default'

export const settingsSchema = z.object({
  version: z.literal(1),
  appearance: z.object({
    theme: z.enum(['dark', 'light', 'system']),
    accent: z.enum(Object.keys(ACCENTS) as [AccentName, ...AccentName[]]),
    scale: z.number().min(0.8).max(1.3),
    reduceMotion: z.boolean(),
    sidebarCollapsed: z.boolean()
  }),
  monitoring: z.object({
    intervalMs: z.number().int().min(500).max(10_000),
    pauseWhenHidden: z.boolean(),
    historyLength: z.number().int().min(30).max(600)
  }),
  startup: z.object({
    launchAtLogin: z.boolean(),
    startMinimized: z.boolean()
  }),
  notifications: z.object({
    enabled: z.boolean()
  }),
  dashboard: z.object({
    activeLayoutId: z.string().min(1).max(64),
    layouts: z.array(layoutSchema).min(1).max(20)
  }),
  commandPalette: z.object({
    recent: z.array(z.string().max(128)).max(20)
  })
})

export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  appearance: {
    theme: 'dark',
    accent: 'indigo',
    scale: 1,
    reduceMotion: false,
    sidebarCollapsed: false
  },
  monitoring: {
    intervalMs: 1500,
    pauseWhenHidden: true,
    historyLength: 120
  },
  startup: {
    launchAtLogin: false,
    startMinimized: false
  },
  notifications: {
    enabled: true
  },
  dashboard: {
    activeLayoutId: DEFAULT_LAYOUT_ID,
    layouts: [{ id: DEFAULT_LAYOUT_ID, name: 'Default', widgets: DEFAULT_WIDGETS }]
  },
  commandPalette: {
    recent: []
  }
}

/** Partial update payload: top level sections, each shallow-partial. */
export type SettingsPatch = {
  [K in Exclude<keyof Settings, 'version'>]?: Partial<Settings[K]>
}

/** Merge a patch into settings (one level deep per section). */
export function applySettingsPatch(current: Settings, patch: SettingsPatch): Settings {
  const next: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || key === 'version') continue
    const prev = (current as Record<string, unknown>)[key]
    next[key] =
      prev && typeof prev === 'object' && !Array.isArray(prev)
        ? { ...(prev as object), ...(value as object) }
        : value
  }
  return next as Settings
}

/** Fill missing fields from defaults so older settings files keep working. */
export function normalizeSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_SETTINGS)
  const merged = applySettingsPatch(structuredClone(DEFAULT_SETTINGS), raw as SettingsPatch)
  const parsed = settingsSchema.safeParse(merged)
  return parsed.success ? parsed.data : structuredClone(DEFAULT_SETTINGS)
}
