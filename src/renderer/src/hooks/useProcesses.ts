import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProcessListResult } from '@shared/system'

/**
 * Polls the process list while the calling component is mounted.
 * Enumerating processes is expensive on Windows, so callers choose a
 * moderate interval and polling stops while the document is hidden.
 */
export function useProcesses(intervalMs: number, enabled = true) {
  const [data, setData] = useState<ProcessListResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.bd.processes.list()
      if (mounted.current) {
        setData(res)
        setError(null)
      }
    } catch (err) {
      if (mounted.current) setError((err as Error).message)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout>
    let cancelled = false
    const loop = async (): Promise<void> => {
      if (!document.hidden) await refresh()
      if (!cancelled) timer = setTimeout(loop, intervalMs)
    }
    void loop()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [intervalMs, enabled, refresh])

  useEffect(
    () => () => {
      mounted.current = false
    },
    []
  )

  return { data, error, loading, refresh }
}
