# BetterDesktop

**One App. Your Entire PC.**

BetterDesktop is a desktop app for Windows 10/11 (with macOS/Linux kept in mind) that combines a PC control center, a developer workspace, system monitoring, utilities and a desktop companion in one polished interface.

> Status: **Phase 1 & 2 are done** (app foundation, dashboard, settings, real-time monitoring, process manager, network monitor, command palette), plus the **Desktop Pet** from Phase 5. Every other module is in the app as a clearly marked "planned" page. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Features available today

| Module | What works |
| --- | --- |
| **Overview** | Customizable dashboard: add/remove/reorder (drag & drop)/resize widgets, multiple saved layouts, restore defaults |
| **PC Control Center** | Live CPU (total + per core), RAM, page file, GPU load and VRAM (any vendor, via Windows GPU counters), disk activity, volumes |
| **Process Manager** | Search, sort, CPU% / memory per process, end task with confirmation and protection for critical Windows processes |
| **Network Monitor** | Active interface, live down/up speed, peak/average, session data usage, connection history |
| **Desktop Pet** | Transparent always-on-top companion on the taskbar (Blob, Cat, Bot): wanders, sleeps, can be carried and dropped, personalities, size, focus mode, sleeps when you are away, CPU/RAM warnings, timers |
| **Command Palette** | `Ctrl+K`, fuzzy search, keyboard navigation, recent commands, categories |
| **Settings** | Dark/light/system theme, accent color, UI scale, reduced motion, monitoring interval, history length, launch at login, data folder, reset |

Shortcuts: `Ctrl+K` command palette · `Ctrl+B` toggle sidebar · `Ctrl+1…9` modules · `Ctrl+,` settings

**No fake data:** if Windows does not expose a value (e.g. CPU temperature without admin rights), BetterDesktop shows *Not available* and explains why.

## Getting started

Requirements: Node.js 20+ and Windows 10/11.

```bash
npm install        # also downloads the Electron binary
npm run dev        # start with hot reload
npm run typecheck  # TypeScript checks for main + renderer
npm run build      # production build into out/
npm run dist       # Windows installer into release/
```

## Tech stack

Electron · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Zustand · Zod · electron-vite

## Documentation

- [Architecture](docs/ARCHITECTURE.md) – processes, IPC and security, how monitoring works
- [Roadmap](docs/ROADMAP.md) – phases and what is next
