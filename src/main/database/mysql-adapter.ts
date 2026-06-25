import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import type { ConnectionConfig, ColumnInfo, QueryResult, TableInfo } from '../../shared/types'
import { MAX_QUERY_ROWS } from '../../shared/types'
import type { DatabaseAdapter } from './types'

export class MysqlAdapter implements DatabaseAdapter {
  private pool: Pool | null = null
  private currentDatabase: string | undefined

  async connect(config: ConnectionConfig): Promise<void> {
    this.currentDatabase = config.database
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database || undefined,
      ssl: config.ssl ? {} : undefined,
      waitForConnections: true,
      connectionLimit: 5
    })

    const connection = await this.pool.getConnection()
    connection.release()
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.pool) return false
    const connection = await this.pool.getConnection()
    connection.release()
    return true
  }

  getCurrentDatabase(): string | undefined {
    return this.currentDatabase
  }

  async switchDatabase(database: string): Promise<void> {
    if (!this.pool) throw new Error('Not connected')
    await this.pool.query(`USE \`${database.replace(/`/g, '``')}\``)
    this.currentDatabase = database
  }

  async listDatabases(): Promise<string[]> {
    const [rows] = await this.pool!.query<RowDataPacket[]>(
      `SELECT SCHEMA_NAME AS name
       FROM information_schema.SCHEMATA
       WHERE SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'sys')
       ORDER BY SCHEMA_NAME`
    )
    return rows.map((row) => String(row.name))
  }

  async listSchemas(): Promise<string[]> {
    return this.listDatabases()
  }

  async listTables(schema: string): Promise<TableInfo[]> {
    const [rows] = await this.pool!.query<RowDataPacket[]>(
      `SELECT TABLE_NAME AS name, TABLE_TYPE AS type
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
         AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
       ORDER BY TABLE_NAME`,
      [schema]
    )
    return rows.map((row) => ({
      name: String(row.name),
      type: String(row.type)
    }))
  }

  async getTableColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const [rows] = await this.pool!.query<RowDataPacket[]>(
      `SELECT
         COLUMN_NAME AS name,
         COLUMN_TYPE AS type,
         IS_NULLABLE AS nullable,
         COLUMN_DEFAULT AS defaultValue,
         COLUMN_KEY AS keyType,
         EXTRA AS extra,
         COLUMN_COMMENT AS comment
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [schema, table]
    )
    return rows.map((row) => ({
      name: String(row.name),
      type: String(row.type),
      nullable: String(row.nullable),
      defaultValue: row.defaultValue == null ? null : String(row.defaultValue),
      keyType: String(row.keyType || ''),
      extra: String(row.extra || ''),
      comment: String(row.comment || '')
    }))
  }

  async getTableDDL(schema: string, table: string): Promise<string> {
    const safeSchema = schema.replace(/`/g, '``')
    const safeTable = table.replace(/`/g, '``')
    const [rows] = await this.pool!.query<RowDataPacket[]>(
      `SHOW CREATE TABLE \`${safeSchema}\`.\`${safeTable}\``
    )
    const row = rows[0]
    return String(row['Create Table'] || row['Create View'] || '')
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    const statement = sql.trim()
    if (!statement) {
      return { success: false, error: 'SQL statement is empty' }
    }

    const isSelect =
      /^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b/i.test(statement) ||
      /^(\(|\/\*)/.test(statement)

    if (isSelect) {
      const limitedSql = /\bLIMIT\s+\d+/i.test(statement)
        ? statement
        : `${statement.replace(/;+\s*$/, '')} LIMIT ${MAX_QUERY_ROWS + 1}`

      const [rows, fields] = await this.pool!.query(limitedSql)
      const resultRows = Array.isArray(rows) ? (rows as RowDataPacket[]) : []
      const truncated = resultRows.length > MAX_QUERY_ROWS
      const slicedRows = truncated ? resultRows.slice(0, MAX_QUERY_ROWS) : resultRows

      return {
        success: true,
        rows: slicedRows.map((row) => ({ ...row })),
        fields: fields?.map((field) => ({
          name: field.name,
          type: String(field.columnType ?? field.type)
        })),
        truncated,
        message: truncated ? `Results limited to ${MAX_QUERY_ROWS} rows` : undefined
      }
    }

    const [result] = await this.pool!.query(statement)
    const info = result as ResultSetHeader
    return {
      success: true,
      affectedRows: info.affectedRows ?? 0,
      message: `${info.affectedRows ?? 0} row(s) affected`
    }
  }
}
