import { Search } from 'lucide-react'
import { useUi } from '@/stores/ui'
import { MODULE_MAP } from '@/modules/registry'
import { Kbd } from '@/components/ui/controls'

export function TitleBar(): React.JSX.Element {
  const setPaletteOpen = useUi((s) => s.setPaletteOpen)
  const module = useUi((s) => MODULE_MAP[s.module])

  return (
    <header className="drag relative flex h-10 shrink-0 items-center border-b border-border bg-chrome pr-[150px] pl-3.5">
      <div className="flex w-[218px] shrink-0 items-center gap-2.5">
        <Logo />
        <span className="text-[13px] font-semibold tracking-tight">
          Better<span className="text-accent">Desktop</span>
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-faint">
        <span>/</span>
        <span className="truncate text-muted">{module.label}</span>
      </div>
      <div className="flex flex-1 justify-center px-4">
        <button
          onClick={() => setPaletteOpen(true)}
          className="no-drag flex h-7 w-full max-w-[420px] items-center gap-2 rounded-lg border border-border bg-surface/80 px-2.5 text-xs text-faint transition-colors hover:border-border-strong hover:text-muted"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search or run a command…</span>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>
    </header>
  )
}

export function Logo({ size = 22 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="bd-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="color-mix(in oklab, var(--accent) 45%, #ffffff)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#bd-logo)" />
      <rect x="7" y="8" width="18" height="12" rx="2.5" fill="none" stroke="white" strokeWidth="2.2" />
      <path d="M12 24.5h8" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M11 16.5l3-3 2.5 2 4.5-4.5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
