import ElectronStoreImport from 'electron-store'
import { randomUUID } from 'crypto'
import type { ConnectionConfig, SavedConnection } from '../../shared/types'

interface StoreSchema {
  connections: SavedConnection[]
}

const ElectronStore =
  typeof ElectronStoreImport === 'function'
    ? ElectronStoreImport
    : (ElectronStoreImport as { default: typeof ElectronStoreImport }).default

const store = new ElectronStore<StoreSchema>({
  name: 'connections',
  defaults: {
    connections: []
  }
})

function encodePassword(password: string): string {
  return Buffer.from(password, 'utf8').toString('base64')
}

function decodePassword(password: string): string {
  return Buffer.from(password, 'base64').toString('utf8')
}

function toSavedConnection(config: ConnectionConfig): SavedConnection {
  return {
    ...config,
    password: encodePassword(config.password)
  }
}

function toConnectionConfig(saved: SavedConnection): ConnectionConfig {
  return {
    ...saved,
    password: decodePassword(saved.password)
  }
}

export function listConnections(): SavedConnection[] {
  return store.get('connections')
}

export function saveConnection(config: ConnectionConfig): SavedConnection {
  const connections = listConnections()
  const saved = toSavedConnection({
    ...config,
    id: config.id || randomUUID()
  })

  const index = connections.findIndex((item) => item.id === saved.id)
  if (index >= 0) {
    connections[index] = saved
  } else {
    connections.push(saved)
  }

  store.set('connections', connections)
  return saved
}

export function deleteConnection(id: string): void {
  const connections = listConnections().filter((item) => item.id !== id)
  store.set('connections', connections)
}

export function getConnectionConfig(id: string): ConnectionConfig | undefined {
  const saved = listConnections().find((item) => item.id === id)
  return saved ? toConnectionConfig(saved) : undefined
}

export function toPublicConnection(saved: SavedConnection): Omit<SavedConnection, 'password'> & {
  hasPassword: boolean
} {
  const { password: _password, ...rest } = saved
  return {
    ...rest,
    hasPassword: Boolean(_password)
  }
}
