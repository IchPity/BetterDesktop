import type { BetterDesktopApi } from './index'

declare global {
  interface Window {
    bd: BetterDesktopApi
  }
}

export {}
