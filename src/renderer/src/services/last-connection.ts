const STORAGE_KEY = 'db-operator:last-connection-id'

export function readLastConnectionId(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function writeLastConnectionId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id)
}

export function clearLastConnectionId(): void {
  localStorage.removeItem(STORAGE_KEY)
}
