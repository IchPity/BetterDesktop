/**
 * Single source of truth for every IPC channel between main and renderer.
 * The renderer never sees these strings directly – it only talks to the
 * typed API exposed by the preload script (see src/preload/index.ts).
 */
export const IPC = {
  appInfo: 'app:info',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsReset: 'settings:reset',
  settingsChanged: 'settings:changed',

  systemStatic: 'system:static',
  systemStart: 'system:start',
  systemStop: 'system:stop',
  systemUpdate: 'system:update',

  processesList: 'processes:list',
  processKill: 'processes:kill'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
