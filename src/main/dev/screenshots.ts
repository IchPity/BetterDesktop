import { app, type BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Development helper: visits a list of views and saves screenshots, then quits.
 * Only runs when BD_SCREENSHOT_DIR is set and the app is not packaged.
 * Optional BD_SCREENSHOT_STEPS: comma separated JS snippets to run before each shot.
 */
const DEFAULT_STEPS = [
  'overview::',
  'pc::',
  'processes::window.__bdNav?.("pc","processes")',
  'network::window.__bdNav?.("network")',
  'settings::window.__bdNav?.("settings")',
  'developer::window.__bdNav?.("developer")',
  'palette::window.__bdNav?.("overview");window.__bdPalette?.(true)',
  'light::window.__bdPalette?.(false);window.__bdTheme?.("light")'
]

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export async function captureScreens(win: BrowserWindow, dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true })
  await new Promise<void>((r) => win.webContents.once('did-finish-load', () => r()))
  win.show()
  await wait(7000)
  const steps = process.env['BD_SCREENSHOT_STEPS']?.split('||') ?? DEFAULT_STEPS
  for (const step of steps) {
    const [name, code] = step.split('::')
    if (name === 'pc') await win.webContents.executeJavaScript('window.__bdNav?.("pc")')
    if (code) await win.webContents.executeJavaScript(code)
    await wait(name === 'processes' ? 6000 : 2500)
    const img = await win.webContents.capturePage()
    writeFileSync(join(dir, `${name}.png`), img.toPNG())
  }
  // restore dark theme so the dev run doesn't leave light mode behind
  await win.webContents.executeJavaScript('window.__bdTheme?.("dark")')
  await wait(800)
  app.quit()
}
