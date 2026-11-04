import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import { App } from '@/App'
import { useUi } from '@/stores/ui'
import { useSettings } from '@/stores/settings'
import { useSystem } from '@/stores/system'
import type { ModuleId } from '@/modules/registry'

// Dev-only hooks used by the screenshot helper (src/main/dev/screenshots.ts).
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>
  w.__bdSys = () => useSystem.getState()
  w.__bdNav = (m: ModuleId, sub?: string) => useUi.getState().navigate(m, sub ?? null)
  w.__bdPalette = (open: boolean) => useUi.getState().setPaletteOpen(open)
  w.__bdUi = () => useUi
  w.__bdTheme = (theme: 'dark' | 'light') => useSettings.getState().update({ appearance: { theme } })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
