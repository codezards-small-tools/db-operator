import { MAX_SQL_HISTORY, type SqlHistoryEntry } from '../../../shared/types'
import { SQL_HISTORY_STORE, openDatabase } from './indexed-db'

function sortEntries(entries: SqlHistoryEntry[]): SqlHistoryEntry[] {
  return entries.sort((a, b) => b.executedAt - a.executedAt)
}

export async function appendSqlHistoryEntry(entry: SqlHistoryEntry): Promise<void> {
  const db = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SQL_HISTORY_STORE, 'readwrite')
    const store = tx.objectStore(SQL_HISTORY_STORE)

    store.put(entry)

    const trimRequest = store.index('connectionId').getAll(entry.connectionId)
    trimRequest.onsuccess = () => {
      const entries = sortEntries(trimRequest.result as SqlHistoryEntry[])
      for (const oldEntry of entries.slice(MAX_SQL_HISTORY)) {
        store.delete(oldEntry.id)
      }
    }
    trimRequest.onerror = () => reject(trimRequest.error ?? new Error('Failed to trim SQL history'))

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to append SQL history'))
    tx.onabort = () => reject(tx.error ?? new Error('Failed to append SQL history'))
  })
}

export async function listSqlHistory(
  connectionId: string,
  limit = MAX_SQL_HISTORY
): Promise<SqlHistoryEntry[]> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SQL_HISTORY_STORE, 'readonly')
    const request = tx.objectStore(SQL_HISTORY_STORE).index('connectionId').getAll(connectionId)

    request.onsuccess = () => {
      resolve(sortEntries(request.result as SqlHistoryEntry[]).slice(0, limit))
    }
    request.onerror = () => reject(request.error ?? new Error('Failed to list SQL history'))
  })
}

export async function deleteSqlHistoryEntry(id: string): Promise<void> {
  const db = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SQL_HISTORY_STORE, 'readwrite')
    tx.objectStore(SQL_HISTORY_STORE).delete(id)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete SQL history entry'))
  })
}

export async function clearSqlHistory(connectionId: string): Promise<void> {
  const db = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SQL_HISTORY_STORE, 'readwrite')
    const store = tx.objectStore(SQL_HISTORY_STORE)
    const request = store.index('connectionId').getAll(connectionId)

    request.onsuccess = () => {
      for (const entry of request.result as SqlHistoryEntry[]) {
        store.delete(entry.id)
      }
    }
    request.onerror = () => reject(request.error ?? new Error('Failed to clear SQL history'))

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear SQL history'))
  })
}
