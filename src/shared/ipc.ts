/**
 * Single source of truth for every IPC channel between main and renderer.
 * The renderer never sees these strings directly – it only talks to the
 * typed API exposed by the preload script (see src/preload/index.ts).
 */
export const IPC = {
  appInfo: 'app:info',
  appOpenDataFolder: 'app:open-data-folder',
  launchTool: 'system:launch-tool',
  /** main -> app window: open a module (e.g. from the pet's context menu). */
  appNavigate: 'app:navigate',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsReset: 'settings:reset',
  settingsChanged: 'settings:changed',

  systemStatic: 'system:static',
  systemStart: 'system:start',
  systemStop: 'system:stop',
  systemUpdate: 'system:update',

  processesList: 'processes:list',
  processKill: 'processes:kill',

  // Desktop Pet – used by the app window
  petStatus: 'pet:status',
  petStatusChanged: 'pet:status-changed',
  petCommand: 'pet:command',
  // Desktop Pet – only accepted from the pet window itself
  petViewGet: 'pet:view-get',
  petViewChanged: 'pet:view-changed',
  petInteractive: 'pet:interactive',
  petDragStart: 'pet:drag-start',
  petDragEnd: 'pet:drag-end',
  petPoke: 'pet:poke',
  petMenu: 'pet:menu',
  petOpenApp: 'pet:open-app',
  petDismissBubble: 'pet:dismiss-bubble'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
