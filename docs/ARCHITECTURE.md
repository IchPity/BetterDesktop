# Architecture

## Folder structure

```
src/
  shared/                 Types & constants used by main AND renderer
    ipc.ts                Every IPC channel name (single source of truth)
    settings.ts           Settings schema (zod), defaults, merge helpers
    system.ts             System metric types (null = not available)
    app.ts                App info, whitelisted Windows tools
    pet.ts                Desktop Pet view/status/command types
  main/                   Electron main process (Node.js)
    index.ts              App lifecycle, single instance, wiring
    window.ts             BrowserWindow creation & security options
    ipc/validate.ts       handle(): sender check + zod payload validation
    ipc/register.ts       All IPC handlers
    services/
      settings-store.ts   JSON settings with debounced atomic writes
      tools.ts            Whitelisted launcher for Windows tools
      pet/controller.ts   Desktop Pet window + behaviour (walk, sleep, drag, timers, warnings)
      system/
        monitor.ts        Live metrics loop + background caches
        providers.ts      WindowsProvider (helper) / GenericProvider (systeminformation)
        win-helper.ts     Manages the persistent PowerShell helper
        win-helper.ps1    The helper script (performance counters)
        processes.ts      Process list with CPU% deltas, safe termination
    dev/screenshots.ts    Dev-only: automated screenshots (BD_SCREENSHOT_DIR)
  preload/
    index.ts              The ONLY API the UI can call (window.bd)
    pet.ts                Tiny API for the pet window (window.pet)
  renderer/               React UI
    src/
      App.tsx             Shell, theme sync, global shortcuts
      pet/                Second renderer entry (pet.html) for the pet window
      components/pet/     PetSprite – SVG characters + CSS animations (shared)
      components/ui/      Design system (Button, Card, Switch, Modal, charts…)
      components/layout/  TitleBar, Sidebar, Page, Toaster
      components/CommandPalette.tsx
      modules/            One folder per sidebar module
        registry.tsx      Module metadata (icon, shortcut, status, phase)
        widgets/          Dashboard widgets
      stores/             Zustand stores (settings, system, ui)
      hooks/              useProcesses …
      lib/                format, fuzzy search
```

## Security model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` for the renderer.
- The preload exposes a **fixed, typed API** (`window.bd`). There is no generic "invoke any channel" or "run command" function.
- Every IPC handler goes through `handle()` which
  1. rejects calls from frames that are not the app's own origin,
  2. validates the payload with a zod schema.
- Navigation and new windows are blocked; `https://` links open in the default browser.
- All web permission requests (camera, mic, …) are denied by default.
- Launching Windows tools uses a **whitelist of keys** (`taskmgr`, `ms-settings:display`, …), never strings from the UI.
- Terminating a process: the UI asks for confirmation, then the main process re-reads the process list, checks that the PID still belongs to the same name and refuses critical Windows processes.
- Content Security Policy: scripts only from the app itself.

## How monitoring works (and why it is cheap)

Windows tools like `systeminformation` spawn a new PowerShell for almost every query. That costs a lot of CPU, so BetterDesktop does it differently:

| Data | Source | Cost |
| --- | --- | --- |
| CPU load (total + per core) | `os.cpus()` time deltas in Node | instant, no process |
| RAM | `os.totalmem()` / `os.freemem()` | instant |
| Network, GPU, disk I/O | **one persistent PowerShell helper** reading .NET performance counters | ~1–2 ms per sample after warm-up |
| Volumes, page file | same helper, every 30 s / 10 s | small |
| Processes | same helper, only while a process view is open | ~100–200 ms |

The helper (`win-helper.ps1`) only answers a fixed set of commands over stdin/stdout and is shut down after 30 s without requests. Monitoring stops completely when no window is subscribed and pauses while the window is minimized (configurable).

GPU load is computed the same way Task Manager does it (per adapter: maximum over engine types of the summed engine utilization), so it works for Intel, AMD and NVIDIA. BetterDesktop deliberately does **not** poll `nvidia-smi`, because that keeps a sleeping laptop GPU awake.

## Desktop Pet

The pet is a second, tiny `BrowserWindow` (transparent, frameless, always on top, not focusable, no taskbar entry) with its own preload (`window.pet`) and renderer entry (`pet.html`). The main process (`PetController`) owns all behaviour and moves the window; the renderer only draws the SVG character for the state it is told.

- **Click-through:** the window ignores the mouse (`setIgnoreMouseEvents(true, { forward: true })`) except while the cursor is over the sprite or speech bubble.
- **Cheap:** animations are CSS transforms; the 30/60 fps frame timer only runs while walking, falling or being dragged. A 5 s watch loop does idle detection (`powerMonitor.getSystemIdleTime`) and CPU/RAM checks with `os.cpus()` / `os.totalmem()` – no extra processes.
- **Isolated IPC:** pet channels are only accepted from the pet window's own `webContents`; the app window controls the pet through settings and `pet:command`.
- Both preloads are built with `isolatedEntries` because sandboxed preloads cannot load shared chunks.

## Settings

Stored as `settings.json` in the user data folder (`%APPDATA%/betterdesktop`). Writes are debounced and atomic (temp file + rename). Unknown or invalid content falls back to defaults field by field. SQLite will be added when modules need real data storage (projects, snippets, workflows – Phase 3+).

## Adding a module

1. Add an entry to `src/renderer/src/modules/registry.tsx` (status `planned` shows the placeholder page automatically).
2. Create `modules/<name>/<Name>.tsx` and register it in `PAGES` in `App.tsx`.
3. If it needs the system: add a channel in `shared/ipc.ts`, a validated handler in `main/ipc/register.ts`, and a typed function in `preload/index.ts`.
4. Add commands for it in `CommandPalette.tsx`.
