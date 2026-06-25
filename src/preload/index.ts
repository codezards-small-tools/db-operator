import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ColumnInfo, ConnectionConfig, DbType, QueryResult, TableInfo } from '../shared/types'

interface ApiResult<T> {
  success: boolean
  data?: T
  error?: string
}

interface ConnectResult {
  success: boolean
  sessionId?: string
  type?: DbType
  database?: string
  error?: string
}

export interface PublicConnection extends Omit<ConnectionConfig, 'password'> {
  hasPassword: boolean
}

export type DbApi = typeof dbApi
export type WindowApi = typeof windowApi

const windowApi = {
  getPlatform: (): Promise<string> => ipcRenderer.invoke('window:getPlatform'),
  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggleMaximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChanged: (callback: (maximized: boolean) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, maximized: boolean): void => {
      callback(maximized)
    }
    ipcRenderer.on('window:maximized-changed', listener)
    return () => {
      ipcRenderer.removeListener('window:maximized-changed', listener)
    }
  }
}

const dbApi = {
  connection: {
    list: (): Promise<PublicConnection[]> => ipcRenderer.invoke('connection:list'),
    save: (config: ConnectionConfig): Promise<PublicConnection> =>
      ipcRenderer.invoke('connection:save', config),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('connection:delete', id),
    test: (config: ConnectionConfig): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('connection:test', config),
    connect: (id: string): Promise<ConnectResult> => ipcRenderer.invoke('connection:connect', id),
    disconnect: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke('connection:disconnect', sessionId)
  },
  schema: {
    listDatabases: (sessionId: string): Promise<ApiResult<string[]>> =>
      ipcRenderer.invoke('schema:list-databases', sessionId),
    listSchemas: (sessionId: string, database?: string): Promise<ApiResult<string[]>> =>
      ipcRenderer.invoke('schema:list-schemas', sessionId, database),
    listTables: (
      sessionId: string,
      schema: string,
      database?: string
    ): Promise<ApiResult<TableInfo[]>> =>
      ipcRenderer.invoke('schema:list-tables', sessionId, schema, database),
    getColumns: (
      sessionId: string,
      schema: string,
      table: string,
      database?: string
    ): Promise<ApiResult<ColumnInfo[]>> =>
      ipcRenderer.invoke('schema:get-columns', sessionId, schema, table, database),
    getDdl: (
      sessionId: string,
      schema: string,
      table: string,
      database?: string
    ): Promise<ApiResult<string>> =>
      ipcRenderer.invoke('schema:get-ddl', sessionId, schema, table, database)
  },
  query: {
    execute: (sessionId: string, sql: string): Promise<QueryResult> =>
      ipcRenderer.invoke('query:execute', sessionId, sql)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('dbApi', dbApi)
    contextBridge.exposeInMainWorld('windowApi', windowApi)
  } catch (error) {
    console.error(error)
  }
} else {
  const globalWindow = window as unknown as Window & {
    electron: typeof electronAPI
    dbApi: typeof dbApi
    windowApi: typeof windowApi
  }
  globalWindow.electron = electronAPI
  globalWindow.dbApi = dbApi
  globalWindow.windowApi = windowApi
}
