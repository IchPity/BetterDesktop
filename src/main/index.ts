import { app, BrowserWindow, nativeTheme, session } from 'electron'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import { registerIpc } from './ipc/register'
import { setTrustedOrigins } from './ipc/validate'
import { SettingsStore } from './services/settings-store'
import { SystemMonitor } from './services/system/monitor'
import { applyWindowSettings, createMainWindow } from './window'

// Only one BetterDesktop instance at a time.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAppUserModelId('dev.betterdesktop.app')
  void bootstrap()
}

async function bootstrap(): Promise<void> {
  await app.whenReady()

  const rendererUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined
  setTrustedOrigins(
    rendererUrl ? [rendererUrl] : [pathToFileURL(join(__dirname, '../renderer')).toString()]
  )

  // Deny every permission request (camera, mic, notifications via web APIs...)
  // until a module explicitly needs one.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))

  const store = new SettingsStore()
  const monitor = new SystemMonitor(store.get().monitoring.intervalMs)
  registerIpc(store, monitor)

  let win = createMainWindow(store.get(), rendererUrl)
  wireWindow(win, store, monitor)

  store.on('change', (settings) => {
    monitor.setIntervalMs(settings.monitoring.intervalMs)
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: settings.startup.launchAtLogin })
    }
    for (const w of BrowserWindow.getAllWindows()) {
      applyWindowSettings(w, settings)
      w.webContents.send(IPC.settingsChanged, settings)
    }
  })

  nativeTheme.on('updated', () => {
    for (const w of BrowserWindow.getAllWindows()) applyWindowSettings(w, store.get())
  })

  app.on('second-instance', () => {
    if (win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      win = createMainWindow(store.get(), rendererUrl)
      wireWindow(win, store, monitor)
    }
  })

  app.on('window-all-closed', () => {
    monitor.dispose()
    if (process.platform !== 'darwin') app.quit()
  })

  let flushed = false
  app.on('before-quit', (e) => {
    if (flushed) return
    e.preventDefault()
    void store.flush().finally(() => {
      flushed = true
      app.quit()
    })
  })
}

/** Pause monitoring while the window is not visible to save CPU. */
function wireWindow(win: BrowserWindow, store: SettingsStore, monitor: SystemMonitor): void {
  const pause = (): void => {
    if (store.get().monitoring.pauseWhenHidden) monitor.pause()
  }
  const resume = (): void => monitor.resume()
  win.on('minimize', pause)
  win.on('hide', pause)
  win.on('restore', resume)
  win.on('show', resume)
}
