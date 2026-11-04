import { app, BrowserWindow, nativeTheme, session } from 'electron'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import { registerIpc } from './ipc/register'
import { setTrustedOrigins } from './ipc/validate'
import { SettingsStore } from './services/settings-store'
import { PetController } from './services/pet/controller'
import { SystemMonitor } from './services/system/monitor'
import { applyWindowSettings, createMainWindow } from './window'

// Dev only: separate data folder, e.g. for screenshot runs that must not touch real settings.
if (!app.isPackaged && process.env['BD_USER_DATA_DIR']) {
  app.setPath('userData', process.env['BD_USER_DATA_DIR'])
}

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

  let win = createMainWindow(store.get(), rendererUrl)

  const pet = new PetController(store.get(), {
    rendererUrl,
    showApp: (module) => {
      if (win.isDestroyed()) return
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      if (module) win.webContents.send(IPC.appNavigate, module)
    },
    updateSettings: (patch) => store.update(patch),
    statusTargets: () => (win.isDestroyed() ? [] : [win.webContents])
  })
  registerIpc(store, monitor, pet)

  wireWindow(win, store, monitor, pet)
  // Wait for the app window so the pet never appears before the app.
  win.once('ready-to-show', () => pet.applySettings(store.get()))
  if (!app.isPackaged && process.env['BD_SCREENSHOT_DIR']) {
    void import('./dev/screenshots').then((m) => m.captureScreens(win, process.env['BD_SCREENSHOT_DIR']!))
  }

  store.on('change', (settings) => {
    monitor.setIntervalMs(settings.monitoring.intervalMs)
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: settings.startup.launchAtLogin })
    }
    pet.applySettings(settings)
    for (const w of appWindows(pet)) {
      applyWindowSettings(w, settings)
      w.webContents.send(IPC.settingsChanged, settings)
    }
  })

  nativeTheme.on('updated', () => {
    for (const w of appWindows(pet)) applyWindowSettings(w, store.get())
  })

  app.on('second-instance', () => {
    if (win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  app.on('activate', () => {
    if (appWindows(pet).length === 0) {
      win = createMainWindow(store.get(), rendererUrl)
      wireWindow(win, store, monitor, pet)
    }
  })

  app.on('window-all-closed', () => {
    pet.dispose()
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

/** All BrowserWindows except the pet (which has its own look and no zoom). */
function appWindows(pet: PetController): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter((w) => !pet.isPetWindow(w))
}

/**
 * Pause monitoring while the window is not visible to save CPU.
 * Closing the app window also removes the pet, so the app really quits.
 */
function wireWindow(win: BrowserWindow, store: SettingsStore, monitor: SystemMonitor, pet: PetController): void {
  win.on('closed', () => pet.dispose())
  const pause = (): void => {
    if (store.get().monitoring.pauseWhenHidden) monitor.pause()
  }
  const resume = (): void => monitor.resume()
  win.on('minimize', pause)
  win.on('hide', pause)
  win.on('restore', resume)
  win.on('show', resume)
}
