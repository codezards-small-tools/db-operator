export type DbType = 'mysql' | 'postgresql'

export interface ConnectionConfig {
  id: string
  name: string
  type: DbType
  host: string
  port: number
  username: string
  password: string
  database?: string
  ssl?: boolean
}

export interface SavedConnection extends Omit<ConnectionConfig, 'password'> {
  password: string
}

export interface TableInfo {
  name: string
  type: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: string
  defaultValue: string | null
  keyType: string
  extra: string
  comment: string
}

export interface QueryField {
  name: string
  type: string
}

export interface QueryResult {
  success: boolean
  rows?: Record<string, unknown>[]
  fields?: QueryField[]
  affectedRows?: number
  message?: string
  truncated?: boolean
  error?: string
}

export interface SqlHistoryEntry {
  id: string
  connectionId: string
  sql: string
  executedAt: number
  success: boolean
  durationMs: number
  rowCount?: number
  affectedRows?: number
  error?: string
}

export const MAX_SQL_HISTORY = 200

export interface SqlEditorTab {
  id: string
  title: string
  sql: string
  createdAt: number
}

export interface SqlEditorWorkspace {
  connectionId: string
  activeSqlTabId: string
  tabs: SqlEditorTab[]
  updatedAt: number
}

export interface ActiveSession {
  sessionId: string
  configId: string
  type: DbType
  database?: string
}

export const MAX_QUERY_ROWS = 1000

export const DEFAULT_PORTS: Record<DbType, number> = {
  mysql: 3306,
  postgresql: 5432
}
