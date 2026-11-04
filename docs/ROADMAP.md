# Roadmap

## ✅ Phase 1 – Foundation
- [x] Electron + React + TypeScript + Tailwind + Framer Motion setup (electron-vite)
- [x] Secure architecture (context isolation, sandbox, validated IPC)
- [x] Main window with custom title bar, collapsible sidebar, page transitions
- [x] Design system (tokens, dark/light, accent colors, components, charts)
- [x] Customizable dashboard (widgets, drag & drop, sizes, layouts)
- [x] Settings with persistent storage
- [x] Command palette (Ctrl+K)

## ✅ Phase 2 – PC Control Center
- [x] CPU (total, per core, history)
- [x] RAM + page file
- [x] GPU load + dedicated VRAM (all vendors, Windows GPU counters)
- [x] Storage volumes + disk activity
- [x] Network monitor
- [x] Process manager (search, sort, end task with confirmation)
- [ ] CPU/GPU temperature, drive health (S.M.A.R.T.) – need an optional elevated helper
- [ ] Live CPU boost clock – needs a driver-level source

## Phase 3 – Developer Workspace  ← next
- [ ] SQLite storage (projects, snippets, notes)
- [ ] Project manager (folders, categories, language detection, Git status, open in VS Code)
- [ ] Integrated terminal (node-pty + xterm.js, tabs, shell selection)
- [ ] Developer dashboard (Node/Python/Git versions, dev servers, recent files)
- [ ] Snippet manager with syntax highlighting
- [ ] Markdown developer notes

## Phase 4 – Advanced Utilities
- [ ] Window Manager (Win32 helper, layouts, hotkeys)
- [ ] Soundboard (Web Audio, hotkeys, profiles, device list)
- [ ] Digital Detective (file type, hashes, duplicates, hex viewer)
- [ ] File Manager

## Phase 5 – Desktop Experience
- [x] Desktop Pet (transparent always-on-top click-through window, 3 characters, personalities, drag & drop, focus mode, idle sleep, CPU/RAM warnings, timers)
- [ ] Desktop Pet: more characters / custom sprite sheets, break reminders
- [ ] Automation Center (triggers, conditions, actions)
- [ ] Custom commands in the command palette

## Phase 6 – Extensibility
- [ ] Plugin system with sandboxed runtime and permissions
- [ ] Plugin Center + developer docs
- [ ] App icon, installer polish, auto-update
