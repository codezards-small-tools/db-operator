import { ipcMain } from 'electron'
import type { ConnectionConfig } from '../../shared/types'
import { connectionManager } from '../database/connection-manager'
import {
  deleteConnection,
  getConnectionConfig,
  listConnections,
  saveConnection,
  toPublicConnection
} from '../store/connection-store'

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function registerIpcHandlers(): void {
  ipcMain.handle('connection:list', async () => {
    return listConnections().map(toPublicConnection)
  })

  ipcMain.handle('connection:save', async (_event, config: ConnectionConfig) => {
    const existing = config.id ? getConnectionConfig(config.id) : undefined
    const password =
      config.password || (existing ? existing.password : '')

    const saved = saveConnection({
      ...config,
      password
    })
    return toPublicConnection(saved)
  })

  ipcMain.handle('connection:delete', async (_event, id: string) => {
    deleteConnection(id)
  })

  ipcMain.handle('connection:test', async (_event, config: ConnectionConfig) => {
    try {
      const existing = config.id ? getConnectionConfig(config.id) : undefined
      const password = config.password || existing?.password || ''
      await connectionManager.testConnection({ ...config, password })
      return { success: true }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipcMain.handle('connection:connect', async (_event, id: string) => {
    try {
      const config = getConnectionConfig(id)
      if (!config) {
        throw new Error('Connection profile not found')
      }
      const sessionId = await connectionManager.connect(id, config)
      return {
        success: true,
        sessionId,
        type: config.type,
        database: config.database
      }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipcMain.handle('connection:disconnect', async (_event, sessionId: string) => {
    await connectionManager.disconnect(sessionId)
  })

  ipcMain.handle('schema:list-databases', async (_event, sessionId: string) => {
    try {
      const adapter = connectionManager.getAdapter(sessionId)
      return { success: true, data: await adapter.listDatabases() }
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })

  ipcMain.handle(
    'schema:list-schemas',
    async (_event, sessionId: string, database?: string) => {
      try {
        const session = connectionManager.getSession(sessionId)
        const adapter = session.adapter
        if (database && adapter.switchDatabase && database !== adapter.getCurrentDatabase()) {
          await adapter.switchDatabase(database)
        }
        return { success: true, data: await adapter.listSchemas(database) }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    }
  )

  ipcMain.handle(
    'schema:list-tables',
    async (
      _event,
      sessionId: string,
      schema: string,
      database?: string
    ) => {
      try {
        const session = connectionManager.getSession(sessionId)
        const adapter = session.adapter
        if (database && adapter.switchDatabase && database !== adapter.getCurrentDatabase()) {
          await adapter.switchDatabase(database)
        }
        return { success: true, data: await adapter.listTables(schema, database) }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    }
  )

  ipcMain.handle(
    'schema:get-columns',
    async (
      _event,
      sessionId: string,
      schema: string,
      table: string,
      database?: string
    ) => {
      try {
        const session = connectionManager.getSession(sessionId)
        const adapter = session.adapter
        if (database && adapter.switchDatabase && database !== adapter.getCurrentDatabase()) {
          await adapter.switchDatabase(database)
        }
        return {
          success: true,
          data: await adapter.getTableColumns(schema, table, database)
        }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    }
  )

  ipcMain.handle(
    'schema:get-ddl',
    async (
      _event,
      sessionId: string,
      schema: string,
      table: string,
      database?: string
    ) => {
      try {
        const session = connectionManager.getSession(sessionId)
        const adapter = session.adapter
        if (database && adapter.switchDatabase && database !== adapter.getCurrentDatabase()) {
          await adapter.switchDatabase(database)
        }
        return {
          success: true,
          data: await adapter.getTableDDL(schema, table, database)
        }
      } catch (error) {
        return { success: false, error: toErrorMessage(error) }
      }
    }
  )

  ipcMain.handle('query:execute', async (_event, sessionId: string, sql: string) => {
    try {
      const adapter = connectionManager.getAdapter(sessionId)
      const statements = sql
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean)

      if (statements.length === 0) {
        return { success: false, error: 'SQL statement is empty' }
      }

      if (statements.length > 1) {
        return {
          success: false,
          error: 'Multiple statements detected. Please execute one statement at a time in MVP.'
        }
      }

      return await adapter.executeQuery(statements[0])
    } catch (error) {
      return { success: false, error: toErrorMessage(error) }
    }
  })
}
