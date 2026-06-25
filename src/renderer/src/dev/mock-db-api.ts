import type { DbApi, PublicConnection } from '../../../preload/index'
import type { ColumnInfo, ConnectionConfig, QueryResult } from '../../../shared/types'

const MOCK_CONNECTION_ID = 'mock-mysql-local'
const MOCK_SESSION_ID = 'mock-session-001'

const mockConnection: PublicConnection = {
  id: MOCK_CONNECTION_ID,
  name: 'Local MySQL (Mock)',
  type: 'mysql',
  host: '127.0.0.1',
  port: 3306,
  username: 'root',
  database: 'demo',
  ssl: false,
  hasPassword: true
}

const mockDatabases = ['demo', 'information_schema', 'mysql']

const mockTables: Record<string, string[]> = {
  demo: ['users', 'orders', 'products'],
  information_schema: ['TABLES', 'COLUMNS'],
  mysql: ['user']
}

const mockColumns: ColumnInfo[] = [
  {
    name: 'id',
    type: 'int(11)',
    nullable: 'NO',
    defaultValue: null,
    keyType: 'PRI',
    extra: 'auto_increment',
    comment: ''
  },
  {
    name: 'username',
    type: 'varchar(64)',
    nullable: 'NO',
    defaultValue: null,
    keyType: 'UNI',
    extra: '',
    comment: 'Login name'
  },
  {
    name: 'email',
    type: 'varchar(255)',
    nullable: 'YES',
    defaultValue: null,
    keyType: '',
    extra: '',
    comment: ''
  },
  {
    name: 'created_at',
    type: 'datetime',
    nullable: 'NO',
    defaultValue: 'CURRENT_TIMESTAMP',
    keyType: '',
    extra: '',
    comment: ''
  }
]

const mockDdl = `CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`username\` varchar(64) NOT NULL,
  \`email\` varchar(255) DEFAULT NULL,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`username\` (\`username\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`

const mockQueryRows = [
  { id: 1, username: 'alice', email: 'alice@example.com', created_at: '2026-01-01 10:00:00' },
  { id: 2, username: 'bob', email: 'bob@example.com', created_at: '2026-01-02 11:30:00' },
  { id: 3, username: 'carol', email: null, created_at: '2026-01-03 09:15:00' }
]

function delay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 150))
}

const mockDbApi: DbApi = {
  connection: {
    list: async () => {
      await delay()
      return [mockConnection]
    },
    save: async (config: ConnectionConfig) => {
      await delay()
      return {
        id: config.id || MOCK_CONNECTION_ID,
        name: config.name,
        type: config.type,
        host: config.host,
        port: config.port,
        username: config.username,
        database: config.database,
        ssl: config.ssl,
        hasPassword: Boolean(config.password)
      }
    },
    delete: async () => {
      await delay()
    },
    test: async () => {
      await delay()
      return { success: true }
    },
    connect: async () => {
      await delay()
      return {
        success: true,
        sessionId: MOCK_SESSION_ID,
        type: 'mysql' as const,
        database: 'demo'
      }
    },
    disconnect: async () => {
      await delay()
    }
  },
  schema: {
    listDatabases: async () => {
      await delay()
      return { success: true, data: mockDatabases }
    },
    listSchemas: async () => {
      await delay()
      return { success: true, data: mockDatabases }
    },
    listTables: async (_sessionId, schema) => {
      await delay()
      const tables = mockTables[schema] ?? []
      return {
        success: true,
        data: tables.map((name) => ({ name, type: 'BASE TABLE' }))
      }
    },
    getColumns: async () => {
      await delay()
      return { success: true, data: mockColumns }
    },
    getDdl: async () => {
      await delay()
      return { success: true, data: mockDdl }
    }
  },
  query: {
    execute: async (_sessionId, sql): Promise<QueryResult> => {
      await delay()
      const statement = sql.trim()
      if (!statement) {
        return { success: false, error: 'SQL statement is empty' }
      }

      if (/^select\b/i.test(statement) || /^show\b/i.test(statement)) {
        return {
          success: true,
          rows: mockQueryRows,
          fields: [
            { name: 'id', type: '3' },
            { name: 'username', type: '253' },
            { name: 'email', type: '253' },
            { name: 'created_at', type: '12' }
          ]
        }
      }

      return {
        success: true,
        affectedRows: 1,
        message: '1 row(s) affected'
      }
    }
  }
}

export function installMockDbApi(): void {
  window.dbApi = mockDbApi
}
