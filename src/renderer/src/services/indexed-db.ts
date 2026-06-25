export const DB_NAME = 'db-operator'
export const DB_VERSION = 2

export const SQL_HISTORY_STORE = 'sql-history'
export const SQL_EDITOR_WORKSPACE_STORE = 'sql-editor-workspace'

let dbPromise: Promise<IDBDatabase> | null = null

export function openDatabase(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result

        if (!db.objectStoreNames.contains(SQL_HISTORY_STORE)) {
          const historyStore = db.createObjectStore(SQL_HISTORY_STORE, { keyPath: 'id' })
          historyStore.createIndex('connectionId', 'connectionId', { unique: false })
          historyStore.createIndex('executedAt', 'executedAt', { unique: false })
        }

        if (!db.objectStoreNames.contains(SQL_EDITOR_WORKSPACE_STORE)) {
          db.createObjectStore(SQL_EDITOR_WORKSPACE_STORE, { keyPath: 'connectionId' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    })
  }

  return dbPromise
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}
