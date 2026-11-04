import type { LucideIcon } from 'lucide-react'
import {
  AppWindow,
  AudioLines,
  CodeXml,
  FolderTree,
  Gauge,
  LayoutDashboard,
  Network,
  PawPrint,
  Puzzle,
  ScanSearch,
  Settings,
  Workflow
} from 'lucide-react'

export type ModuleId =
  | 'overview'
  | 'pc'
  | 'developer'
  | 'windows'
  | 'soundboard'
  | 'detective'
  | 'pet'
  | 'automation'
  | 'files'
  | 'network'
  | 'plugins'
  | 'settings'

export interface ModuleMeta {
  id: ModuleId
  label: string
  icon: LucideIcon
  description: string
  /** Ctrl + <key> shortcut. */
  shortcut?: string
  status: 'ready' | 'planned'
  phase: number
  group: 'main' | 'tools' | 'system'
  /** For planned modules: what will be built and what it needs. */
  planned?: {
    features: string[]
    requirements: string[]
  }
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    description: 'Your customizable dashboard.',
    shortcut: '1',
    status: 'ready',
    phase: 1,
    group: 'main'
  },
  {
    id: 'pc',
    label: 'PC Control Center',
    icon: Gauge,
    description: 'Real-time CPU, memory, GPU, storage, network and processes.',
    shortcut: '2',
    status: 'ready',
    phase: 2,
    group: 'main'
  },
  {
    id: 'developer',
    label: 'Developer Workspace',
    icon: CodeXml,
    description: 'Projects, terminal, snippets and notes for programmers.',
    shortcut: '3',
    status: 'planned',
    phase: 3,
    group: 'main',
    planned: {
      features: [
        'Project manager with language detection and Git status',
        'Integrated terminal with tabs and configurable shell',
        'Developer dashboard (Node, Python, Git versions, dev servers)',
        'Snippet manager with syntax highlighting',
        'Markdown developer notes per project'
      ],
      requirements: [
        'node-pty (native module) for a real terminal, rebuilt for Electron',
        'xterm.js for terminal rendering',
        'SQLite storage for projects, snippets and notes',
        'Scoped file-system access to user-chosen project folders only'
      ]
    }
  },
  {
    id: 'windows',
    label: 'Window Manager',
    icon: AppWindow,
    description: 'Detect, arrange and restore window layouts.',
    shortcut: '4',
    status: 'planned',
    phase: 4,
    group: 'tools',
    planned: {
      features: [
        'List of open windows and running applications',
        'Predefined layouts (Developer, Gaming, Productivity, Research)',
        'Custom layouts, save and restore arrangements',
        'Global keyboard shortcuts, multi-monitor support'
      ],
      requirements: [
        'Win32 APIs (EnumWindows, SetWindowPos) via a small native helper',
        'Windows that run elevated cannot be moved by a non-elevated app (UIPI)',
        'Global shortcuts registered through Electron globalShortcut'
      ]
    }
  },
  {
    id: 'soundboard',
    label: 'Soundboard',
    icon: AudioLines,
    description: 'Custom sounds, categories, profiles and hotkeys.',
    shortcut: '5',
    status: 'planned',
    phase: 4,
    group: 'tools',
    planned: {
      features: [
        'Import audio files, categories, collections and search',
        'Per-sound volume, preview, simultaneous playback',
        'Global hotkeys and sound profiles',
        'Audio device overview and output selection'
      ],
      requirements: [
        'Web Audio API for playback (natively supported)',
        'Per-app audio routing needs Windows Core Audio APIs – requires a native helper',
        'System event sounds are changed only after explicit confirmation, with restore'
      ]
    }
  },
  {
    id: 'detective',
    label: 'Digital Detective',
    icon: ScanSearch,
    description: 'File analysis, hashes, duplicates and hex viewer.',
    shortcut: '6',
    status: 'planned',
    phase: 4,
    group: 'tools',
    planned: {
      features: [
        'File type detection (magic bytes), metadata, timestamps',
        'SHA-256 hashing, duplicate finder, file comparison',
        'Folder structure visualization and large file finder',
        'Hex viewer and text preview'
      ],
      requirements: [
        'Streaming hashing in a worker thread so the UI never blocks',
        'Read-only by default – any deletion requires explicit confirmation'
      ]
    }
  },
  {
    id: 'pet',
    label: 'Desktop Pet',
    icon: PawPrint,
    description: 'A companion that lives on your desktop.',
    shortcut: '7',
    status: 'planned',
    phase: 5,
    group: 'tools',
    planned: {
      features: [
        'Transparent always-on-top window with idle, walk, sleep and interaction animations',
        'Personalities, characters, size and position',
        'Optional CPU / RAM warnings, reminders and timers',
        'Almost-invisible "focus" mode'
      ],
      requirements: [
        'Separate lightweight BrowserWindow (transparent, click-through where idle)',
        'Sprite sheets / Lottie animations for characters',
        'Frame-rate throttling to keep CPU usage near zero'
      ]
    }
  },
  {
    id: 'automation',
    label: 'Automation Center',
    icon: Workflow,
    description: 'Triggers, conditions and actions – fully user controlled.',
    shortcut: '8',
    status: 'planned',
    phase: 5,
    group: 'tools',
    planned: {
      features: [
        'Visual workflow builder: triggers, conditions, actions',
        'Triggers: app opened, time, CPU threshold, folder changed',
        'Enable/disable, manual run, history and error handling'
      ],
      requirements: [
        'Event sources from System Monitor, Window Manager and file watchers',
        'Persistent workflow storage (SQLite) and an execution log'
      ]
    }
  },
  {
    id: 'files',
    label: 'File Manager',
    icon: FolderTree,
    description: 'Browse, search, preview and manage files.',
    shortcut: '9',
    status: 'planned',
    phase: 4,
    group: 'tools',
    planned: {
      features: [
        'Browse folders, sort by name/size/type/date',
        'Search, previews, favorites and recent files',
        'Storage visualization',
        'File operations with confirmation for destructive actions'
      ],
      requirements: ['Validated file-system IPC with path normalization', 'Recycle bin (shell.trashItem) instead of permanent delete']
    }
  },
  {
    id: 'network',
    label: 'Network Monitor',
    icon: Network,
    description: 'Connection, throughput and interface details.',
    status: 'ready',
    phase: 2,
    group: 'system'
  },
  {
    id: 'plugins',
    label: 'Plugin Center',
    icon: Puzzle,
    description: 'Install, enable and configure plugins.',
    status: 'planned',
    phase: 6,
    group: 'system',
    planned: {
      features: [
        'Plugin manifest (name, version, author, icon, permissions)',
        'Browse, enable, disable, configure and remove plugins',
        'Developer documentation and plugin template'
      ],
      requirements: [
        'Sandboxed plugin runtime (isolated iframe / utility process)',
        'Permission prompts – plugins never get unrestricted system access'
      ]
    }
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    description: 'Appearance, monitoring, startup and data.',
    shortcut: ',',
    status: 'ready',
    phase: 1,
    group: 'system'
  }
]

export const MODULE_MAP = Object.fromEntries(MODULES.map((m) => [m.id, m])) as Record<ModuleId, ModuleMeta>
