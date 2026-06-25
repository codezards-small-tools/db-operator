import { Pool, type QueryResultRow } from 'pg'
import type { ConnectionConfig, ColumnInfo, QueryResult, TableInfo } from '../../shared/types'
import { MAX_QUERY_ROWS } from '../../shared/types'
import type { DatabaseAdapter } from './types'

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool | null = null
  private currentDatabase: string | undefined
  private connectionConfig: ConnectionConfig | null = null

  async connect(config: ConnectionConfig): Promise<void> {
    this.connectionConfig = config
    this.currentDatabase = config.database || 'postgres'
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: this.currentDatabase,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: 5
    })

    await this.pool.query('SELECT 1')
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
    this.connectionConfig = null
  }

  async testConnection(): Promise<boolean> {
    if (!this.pool) return false
    await this.pool.query('SELECT 1')
    return true
  }

  getCurrentDatabase(): string | undefined {
    return this.currentDatabase
  }

  async switchDatabase(database: string): Promise<void> {
    if (!this.connectionConfig) throw new Error('Not connected')
    const nextConfig = { ...this.connectionConfig, database }
    await this.disconnect()
    await this.connect(nextConfig)
  }

  async listDatabases(): Promise<string[]> {
    const result = await this.pool!.query<{ datname: string }>(
      `SELECT datname
       FROM pg_database
       WHERE datistemplate = false
       ORDER BY datname`
    )
    return result.rows.map((row) => row.datname)
  }

  async listSchemas(): Promise<string[]> {
    const result = await this.pool!.query<{ schema_name: string }>(
      `SELECT schema_name
       FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
         AND schema_name NOT LIKE 'pg_temp_%'
         AND schema_name NOT LIKE 'pg_toast_temp_%'
       ORDER BY schema_name`
    )
    return result.rows.map((row) => row.schema_name)
  }

  async listTables(schema: string): Promise<TableInfo[]> {
    const result = await this.pool!.query<{ name: string; type: string }>(
      `SELECT table_name AS name, table_type AS type
       FROM information_schema.tables
       WHERE table_schema = $1
         AND table_type IN ('BASE TABLE', 'VIEW')
       ORDER BY table_name`,
      [schema]
    )
    return result.rows
  }

  async getTableColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const result = await this.pool!.query<{
      name: string
      type: string
      nullable: string
      defaultValue: string | null
      keyType: string
      extra: string
      comment: string
    }>(
      `SELECT
         c.column_name AS name,
         c.udt_name AS type,
         c.is_nullable AS nullable,
         c.column_default AS "defaultValue",
         CASE
           WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PRI'
           WHEN tc.constraint_type = 'UNIQUE' THEN 'UNI'
           ELSE ''
         END AS "keyType",
         '' AS extra,
         COALESCE(pgd.description, '') AS comment
       FROM information_schema.columns c
       LEFT JOIN pg_catalog.pg_statio_all_tables st
         ON st.schemaname = c.table_schema AND st.relname = c.table_name
       LEFT JOIN pg_catalog.pg_description pgd
         ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
       LEFT JOIN information_schema.key_column_usage kcu
         ON kcu.table_schema = c.table_schema
         AND kcu.table_name = c.table_name
         AND kcu.column_name = c.column_name
       LEFT JOIN information_schema.table_constraints tc
         ON tc.constraint_schema = kcu.constraint_schema
         AND tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
         AND tc.table_name = kcu.table_name
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      [schema, table]
    )

    return result.rows.map((row) => ({
      name: row.name,
      type: row.type,
      nullable: row.nullable,
      defaultValue: row.defaultValue,
      keyType: row.keyType || '',
      extra: row.extra || '',
      comment: row.comment || ''
    }))
  }

  async getTableDDL(schema: string, table: string): Promise<string> {
    const columns = await this.getTableColumns(schema, table)
    const lines = columns.map((column) => {
      let line = `  "${column.name}" ${column.type}`
      if (column.nullable === 'NO') line += ' NOT NULL'
      if (column.defaultValue != null) line += ` DEFAULT ${column.defaultValue}`
      return line
    })

    return `CREATE TABLE "${schema}"."${table}" (\n${lines.join(',\n')}\n);`
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    const statement = sql.trim()
    if (!statement) {
      return { success: false, error: 'SQL statement is empty' }
    }

    const isSelect =
      /^(SELECT|WITH|SHOW|EXPLAIN)\b/i.test(statement) || /^(\(|\/\*)/.test(statement)

    if (isSelect) {
      const limitedSql = /\bLIMIT\s+\d+/i.test(statement)
        ? statement
        : `${statement.replace(/;+\s*$/, '')} LIMIT ${MAX_QUERY_ROWS + 1}`

      const result = await this.pool!.query(limitedSql)
      const truncated = result.rows.length > MAX_QUERY_ROWS
      const rows = truncated ? result.rows.slice(0, MAX_QUERY_ROWS) : result.rows

      return {
        success: true,
        rows: rows.map((row: QueryResultRow) => ({ ...row })),
        fields: result.fields.map((field) => ({
          name: field.name,
          type: String(field.dataTypeID)
        })),
        truncated,
        message: truncated ? `Results limited to ${MAX_QUERY_ROWS} rows` : undefined
      }
    }

    const result = await this.pool!.query(statement)
    return {
      success: true,
      affectedRows: result.rowCount ?? 0,
      message: `${result.rowCount ?? 0} row(s) affected`
    }
  }
}
