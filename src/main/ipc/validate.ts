import type { IpcMainInvokeEvent } from 'electron'
import { ipcMain } from 'electron'
import type { z } from 'zod'

let trustedOrigins: string[] = []

/** Origins allowed to talk to the main process (dev server or packaged files). */
export function setTrustedOrigins(origins: string[]): void {
  trustedOrigins = origins
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? ''
  return trustedOrigins.some((o) => url.startsWith(o))
}

/**
 * Registers an invoke handler that
 *  1. rejects calls from untrusted frames,
 *  2. validates the payload with a zod schema before the handler sees it.
 */
export function handle<S extends z.ZodType, R>(
  channel: string,
  schema: S,
  handler: (payload: z.infer<S>, event: IpcMainInvokeEvent) => R | Promise<R>
): void {
  ipcMain.handle(channel, async (event, raw: unknown) => {
    if (!isTrustedSender(event)) {
      throw new Error(`Blocked IPC call to "${channel}" from untrusted origin`)
    }
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      throw new Error(`Invalid payload for "${channel}": ${parsed.error.issues[0]?.message ?? 'unknown'}`)
    }
    return handler(parsed.data, event)
  })
}
