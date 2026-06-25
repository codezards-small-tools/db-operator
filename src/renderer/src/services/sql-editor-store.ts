import type { SqlEditorWorkspace } from '../../../shared/types'
import {
  SQL_EDITOR_WORKSPACE_STORE,
  openDatabase,
  requestToPromise
} from './indexed-db'

export async function loadSqlEditorWorkspace(
  connectionId: string
): Promise<SqlEditorWorkspace | null> {
  const db = await openDatabase()
  const workspace = await requestToPromise(
    db.transaction(SQL_EDITOR_WORKSPACE_STORE, 'readonly')
      .objectStore(SQL_EDITOR_WORKSPACE_STORE)
      .get(connectionId)
  )

  return (workspace as SqlEditorWorkspace | undefined) ?? null
}

export async function saveSqlEditorWorkspace(workspace: SqlEditorWorkspace): Promise<void> {
  const db = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SQL_EDITOR_WORKSPACE_STORE, 'readwrite')
    tx.objectStore(SQL_EDITOR_WORKSPACE_STORE).put(workspace)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save SQL editor workspace'))
  })
}

export async function deleteSqlEditorWorkspace(connectionId: string): Promise<void> {
  const db = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SQL_EDITOR_WORKSPACE_STORE, 'readwrite')
    tx.objectStore(SQL_EDITOR_WORKSPACE_STORE).delete(connectionId)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete SQL editor workspace'))
  })
}
