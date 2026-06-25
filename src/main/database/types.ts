import type {
  ColumnInfo,
  ConnectionConfig,
  QueryResult,
  TableInfo
} from '../../shared/types'

export interface DatabaseAdapter {
  connect(config: ConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  testConnection(): Promise<boolean>
  getCurrentDatabase(): string | undefined
  switchDatabase?(database: string): Promise<void>
  listDatabases(): Promise<string[]>
  listSchemas(database?: string): Promise<string[]>
  listTables(schema: string, database?: string): Promise<TableInfo[]>
  getTableColumns(schema: string, table: string, database?: string): Promise<ColumnInfo[]>
  getTableDDL(schema: string, table: string, database?: string): Promise<string>
  executeQuery(sql: string): Promise<QueryResult>
}
