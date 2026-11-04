import { create } from 'zustand'
import type { SystemSnapshot, SystemStatic } from '@shared/system'

export interface History {
  cpu: number[]
  mem: number[]
  rx: number[]
  tx: number[]
  gpu: number[]
  /** Per-core load history, index = core */
  cores: number[][]
}

interface SystemState {
  static: SystemStatic | null
  staticError: string | null
  snapshot: SystemSnapshot | null
  history: History
  historyLength: number
  sessionStart: number
  /** Bytes transferred since BetterDesktop started (real counter diff). */
  session: { rxStart: number | null; txStart: number | null }
  connectionLog: Array<{ at: number; state: string; iface: string | null }>
  setHistoryLength: (n: number) => void
}

const emptyHistory = (): History => ({ cpu: [], mem: [], rx: [], tx: [], gpu: [], cores: [] })

export const useSystem = create<SystemState>((set) => ({
  static: null,
  staticError: null,
  snapshot: null,
  history: emptyHistory(),
  historyLength: 120,
  sessionStart: Date.now(),
  session: { rxStart: null, txStart: null },
  connectionLog: [],
  setHistoryLength: (n) => set({ historyLength: n })
}))

function push(arr: number[], v: number, max: number): number[] {
  const next = arr.length >= max ? arr.slice(arr.length - max + 1) : arr.slice()
  next.push(v)
  return next
}

let started = false

/** Starts streaming live metrics from the main process (idempotent). */
export function startSystemStream(): void {
  if (started) return
  started = true

  window.bd.system
    .static()
    .then((s) => useSystem.setState({ static: s }))
    .catch((err: Error) => useSystem.setState({ staticError: err.message }))

  window.bd.system.onUpdate((snap) => {
    useSystem.setState((st) => {
      const max = st.historyLength
      const h = st.history
      const gpuUtil = snap.gpu?.load ?? null
      const cores = snap.cpu.cores.map((load, i) => push(h.cores[i] ?? [], load, max))

      const session = { ...st.session }
      if (session.rxStart === null && snap.network.rxTotal !== null) session.rxStart = snap.network.rxTotal
      if (session.txStart === null && snap.network.txTotal !== null) session.txStart = snap.network.txTotal

      let log = st.connectionLog
      const prev = st.snapshot?.network
      const state = snap.network.operstate ?? 'unknown'
      if (
        snap.network.operstate !== null &&
        (!prev || prev.operstate !== snap.network.operstate || prev.iface !== snap.network.iface)
      ) {
        log = [{ at: snap.timestamp, state, iface: snap.network.ifaceName ?? snap.network.iface }, ...log].slice(0, 50)
      }

      return {
        snapshot: snap,
        session,
        connectionLog: log,
        history: {
          cpu: push(h.cpu, snap.cpu.load, max),
          mem: push(h.mem, (snap.mem.used / snap.mem.total) * 100, max),
          rx: push(h.rx, snap.network.rxPerSec ?? 0, max),
          tx: push(h.tx, snap.network.txPerSec ?? 0, max),
          gpu: gpuUtil === null ? h.gpu : push(h.gpu, gpuUtil, max),
          cores
        }
      }
    })
  })

  void window.bd.system.start()
}
