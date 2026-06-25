import { randomUUID } from 'crypto'
import type { ConnectionConfig, DbType } from '../../shared/types'
import { MysqlAdapter } from './mysql-adapter'
import { PostgresAdapter } from './postgres-adapter'
import type { DatabaseAdapter } from './types'

interface ManagedSession {
  sessionId: string
  configId: string
  type: DbType
  adapter: DatabaseAdapter
}

export class ConnectionManager {
  private sessions = new Map<string, ManagedSession>()

  private createAdapter(type: DbType): DatabaseAdapter {
    return type === 'mysql' ? new MysqlAdapter() : new PostgresAdapter()
  }

  async connect(configId: string, config: ConnectionConfig): Promise<string> {
    const existing = [...this.sessions.values()].find((session) => session.configId === configId)
    if (existing) {
      await existing.adapter.disconnect()
      this.sessions.delete(existing.sessionId)
    }

    const adapter = this.createAdapter(config.type)
    await adapter.connect(config)

    const sessionId = randomUUID()
    this.sessions.set(sessionId, {
      sessionId,
      configId,
      type: config.type,
      adapter
    })

    return sessionId
  }

  async disconnect(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    await session.adapter.disconnect()
    this.sessions.delete(sessionId)
  }

  async testConnection(config: ConnectionConfig): Promise<boolean> {
    const adapter = this.createAdapter(config.type)
    try {
      await adapter.connect(config)
      return await adapter.testConnection()
    } finally {
      await adapter.disconnect()
    }
  }

  getSession(sessionId: string): ManagedSession {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Connection session not found. Please reconnect.')
    }
    return session
  }

  getAdapter(sessionId: string): DatabaseAdapter {
    return this.getSession(sessionId).adapter
  }

  async disconnectAll(): Promise<void> {
    const sessionIds = [...this.sessions.keys()]
    await Promise.all(sessionIds.map((sessionId) => this.disconnect(sessionId)))
  }
}

export const connectionManager = new ConnectionManager()
