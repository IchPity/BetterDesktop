export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  userDataPath: string
}

/** Fixed set of Windows tools the UI may open. No arbitrary commands. */
export const SYSTEM_TOOLS = {
  taskmgr: 'Task Manager',
  explorer: 'File Explorer',
  'settings-display': 'Display settings',
  'settings-sound': 'Sound settings',
  'settings-network': 'Network settings',
  'settings-storage': 'Storage settings',
  control: 'Control Panel'
} as const
export type SystemTool = keyof typeof SYSTEM_TOOLS
