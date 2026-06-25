import { message } from 'antd'
import type { DbType } from '../../../shared/types'
import { useAppStore } from '../stores/connection'

const RETRY_INTERVAL_MS = 10_000
const MAX_DURATION_MS = 60_000

let abortController: AbortController | null = null
let currentConnectPromise: Promise<string | null> | null = null
let connectingConnectionId: string | null = null

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true }
    )
  })
}

async function tryConnect(
  connectionId: string
): Promise<{ sessionId: string; dbType: DbType } | null> {
  const result = await window.dbApi.connection.connect(connectionId)
  if (!result.success || !result.sessionId || !result.type) {
    return null
  }
  return { sessionId: result.sessionId, dbType: result.type }
}

export function cancelConnect(): void {
  abortController?.abort()
  abortController = null
  currentConnectPromise = null
  connectingConnectionId = null
}

export function startConnect(connectionId: string): void {
  cancelConnect()

  abortController = new AbortController()
  const signal = abortController.signal
  connectingConnectionId = connectionId

  currentConnectPromise = (async (): Promise<string | null> => {
    const startedAt = Date.now()
    let attempt = 0

    const { activeSessionId } = useAppStore.getState()
    if (activeSessionId) {
      try {
        await window.dbApi.connection.disconnect(activeSessionId)
      } catch {
        // ignore disconnect errors during switch
      }
      useAppStore.getState().clearSession()
    }

    while (Date.now() - startedAt < MAX_DURATION_MS) {
      if (signal.aborted) return null

      attempt += 1
      const status = attempt === 1 ? 'connecting' : 'retrying'
      useAppStore.getState().setConnectionStatus(status, attempt)

      const result = await tryConnect(connectionId)
      if (signal.aborted) return null

      if (result) {
        useAppStore.getState().establishSession(result.sessionId, result.dbType)
        return result.sessionId
      }

      if (Date.now() - startedAt + RETRY_INTERVAL_MS >= MAX_DURATION_MS) {
        break
      }

      try {
        await sleep(RETRY_INTERVAL_MS, signal)
      } catch {
        return null
      }
    }

    if (!signal.aborted) {
      useAppStore.getState().setConnectionStatus('failed', attempt)
      const connection = useAppStore.getState().connections.find((item) => item.id === connectionId)
      message.error(`Failed to connect to ${connection?.name ?? 'database'}`)
    }

    return null
  })()
}

export async function ensureConnected(): Promise<string | null> {
  const { activeConnectionId, activeSessionId } = useAppStore.getState()

  if (!activeConnectionId) return null
  if (activeSessionId) return activeSessionId

  if (currentConnectPromise && connectingConnectionId === activeConnectionId) {
    return currentConnectPromise
  }

  startConnect(activeConnectionId)
  return currentConnectPromise ?? null
}

export async function disconnectCurrent(): Promise<void> {
  cancelConnect()
  const { activeSessionId } = useAppStore.getState()
  if (activeSessionId) {
    await window.dbApi.connection.disconnect(activeSessionId)
  }
  useAppStore.getState().clearSession()
}
