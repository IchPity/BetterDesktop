import { BrowserWindow, nativeTheme, screen, shell } from 'electron'
import { join } from 'node:path'
import type { Settings } from '@shared/settings'

export const TITLEBAR_HEIGHT = 40

const CHROME = {
  dark: { color: '#0e0f13', symbolColor: '#a1a5b3' },
  light: { color: '#f4f5f7', symbolColor: '#4b4f5c' }
}

export function resolveTheme(settings: Settings): 'dark' | 'light' {
  const t = settings.appearance.theme
  if (t === 'system') return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  return t
}

export function createMainWindow(settings: Settings, rendererUrl: string | undefined): BrowserWindow {
  const theme = resolveTheme(settings)

  // Fit the window to the current screen (laptops with 125-150 % scaling are small).
  const area = screen.getPrimaryDisplay().workAreaSize
  const width = Math.min(1440, Math.round(area.width * 0.9))
  const height = Math.min(900, Math.round(area.height * 0.9))

  const win = new BrowserWindow({
    width,
    height,
    center: true,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: 'BetterDesktop',
    backgroundColor: CHROME[theme].color,
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...CHROME[theme], height: TITLEBAR_HEIGHT },
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: !!rendererUrl
    }
  })

  win.once('ready-to-show', () => {
    win.webContents.setZoomFactor(settings.appearance.scale)
    if (settings.startup.startMinimized) win.minimize()
    else win.show()
  })

  // Never let the renderer navigate away or open new Electron windows.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (rendererUrl && url.startsWith(rendererUrl)) return
    e.preventDefault()
  })

  if (rendererUrl) void win.loadURL(rendererUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))

  return win
}

export function applyWindowSettings(win: BrowserWindow, settings: Settings): void {
  const theme = resolveTheme(settings)
  win.setBackgroundColor(CHROME[theme].color)
  try {
    win.setTitleBarOverlay({ ...CHROME[theme], height: TITLEBAR_HEIGHT })
  } catch {
    // not supported on this platform
  }
  win.webContents.setZoomFactor(settings.appearance.scale)
}
