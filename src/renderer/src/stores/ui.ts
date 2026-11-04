import { create } from 'zustand'
import type { ModuleId } from '@/modules/registry'

export interface Toast {
  id: number
  tone: 'info' | 'success' | 'warning' | 'danger'
  title: string
  description?: string
}

interface UiState {
  module: ModuleId
  /** Optional sub-view inside a module, e.g. the "processes" tab. */
  subview: string | null
  paletteOpen: boolean
  dashboardEditing: boolean
  toasts: Toast[]
  navigate: (module: ModuleId, subview?: string | null) => void
  setPaletteOpen: (open: boolean) => void
  setDashboardEditing: (v: boolean) => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

let toastId = 0

export const useUi = create<UiState>((set) => ({
  module: 'overview',
  subview: null,
  paletteOpen: false,
  dashboardEditing: false,
  toasts: [],
  navigate: (module, subview = null) => set({ module, subview, paletteOpen: false }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setDashboardEditing: (dashboardEditing) => set({ dashboardEditing }),
  toast: (t) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4500)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
}))

export const toast = (t: Omit<Toast, 'id'>): void => useUi.getState().toast(t)
