import { create } from 'zustand'
import type {
  ColumnInfo,
  ConnectionConfig,
  DbType,
  QueryResult,
  SqlEditorTab,
  SqlEditorWorkspace,
  SqlHistoryEntry
} from '../../../shared/types'
import type { PublicConnection } from '../../../preload/index'
import { startConnect } from '../services/connection-session'
import {
  clearLastConnectionId,
  readLastConnectionId,
  writeLastConnectionId
} from '../services/last-connection'
import {
  deleteSqlEditorWorkspace,
  loadSqlEditorWorkspace,
  saveSqlEditorWorkspace
} from '../services/sql-editor-store'
import {
  appendSqlHistoryEntry as persistSqlHistoryEntry,
  clearSqlHistory as clearPersistedSqlHistory,
  deleteSqlHistoryEntry as deletePersistedSqlHistoryEntry,
  listSqlHistory
} from '../services/sql-history-store'

export interface SelectedTable {
  schema: string
  table: string
  database?: string
}

export interface QueryResultTab {
  id: string
  sql: string
  createdAt: number
  result: QueryResult
}

export interface ConnectionWorkspace {
  sqlTabs: SqlEditorTab[]
  activeSqlTabId: string | null
  resultTabs: QueryResultTab[]
  activeResultTabId: string | null
}

export type ConnectionStatus = 'idle' | 'connecting' | 'retrying' | 'connected' | 'failed'

type LegacyConnectionWorkspace = ConnectionWorkspace & { sql?: string }

let persistSqlEditorTimer: ReturnType<typeof setTimeout> | null = null

function createDefaultSqlTab(title = 'Query 1'): SqlEditorTab {
  return {
    id: crypto.randomUUID(),
    title,
    sql: '',
    createdAt: Date.now()
  }
}

function nextSqlTabTitle(tabs: SqlEditorTab[]): string {
  const usedNumbers = tabs
    .map((tab) => /^Query (\d+)$/.exec(tab.title.trim())?.[1])
    .filter(Boolean)
    .map((value) => Number(value))

  const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : tabs.length + 1
  return `Query ${nextNumber}`
}

function emptyWorkspace(): ConnectionWorkspace {
  const tab = createDefaultSqlTab()
  return {
    sqlTabs: [tab],
    activeSqlTabId: tab.id,
    resultTabs: [],
    activeResultTabId: null
  }
}

function normalizeWorkspace(raw: LegacyConnectionWorkspace | undefined): ConnectionWorkspace {
  if (!raw) return emptyWorkspace()

  if (Array.isArray(raw.sqlTabs) && raw.sqlTabs.length > 0) {
    const activeSqlTabId =
      raw.activeSqlTabId && raw.sqlTabs.some((tab) => tab.id === raw.activeSqlTabId)
        ? raw.activeSqlTabId
        : raw.sqlTabs[0].id

    return {
      sqlTabs: raw.sqlTabs,
      activeSqlTabId,
      resultTabs: raw.resultTabs ?? [],
      activeResultTabId: raw.activeResultTabId ?? null
    }
  }

  if (typeof raw.sql === 'string') {
    const tab = createDefaultSqlTab('Query 1')
    tab.sql = raw.sql
    return {
      sqlTabs: [tab],
      activeSqlTabId: tab.id,
      resultTabs: raw.resultTabs ?? [],
      activeResultTabId: raw.activeResultTabId ?? null
    }
  }

  return emptyWorkspace()
}

function snapshotWorkspace(state: {
  sqlTabs: SqlEditorTab[]
  activeSqlTabId: string | null
  resultTabs: QueryResultTab[]
  activeResultTabId: string | null
}): ConnectionWorkspace {
  return {
    sqlTabs: state.sqlTabs,
    activeSqlTabId: state.activeSqlTabId,
    resultTabs: state.resultTabs,
    activeResultTabId: state.activeResultTabId
  }
}

function applyWorkspace(workspace: ConnectionWorkspace): Pick<
  AppState,
  'sqlTabs' | 'activeSqlTabId' | 'resultTabs' | 'activeResultTabId'
> {
  const normalized = normalizeWorkspace(workspace)
  return {
    sqlTabs: normalized.sqlTabs,
    activeSqlTabId: normalized.activeSqlTabId,
    resultTabs: normalized.resultTabs,
    activeResultTabId: normalized.activeResultTabId
  }
}

function persistWorkspace(
  workspaces: Record<string, ConnectionWorkspace>,
  connectionId: string | null,
  workspace: ConnectionWorkspace
): Record<string, ConnectionWorkspace> {
  if (!connectionId) return workspaces
  return { ...workspaces, [connectionId]: workspace }
}

function buildSqlHistoryEntry(
  connectionId: string,
  sql: string,
  result: QueryResult,
  durationMs: number
): SqlHistoryEntry {
  return {
    id: crypto.randomUUID(),
    connectionId,
    sql,
    executedAt: Date.now(),
    success: result.success,
    durationMs,
    rowCount: result.rows?.length,
    affectedRows: result.affectedRows,
    error: result.error
  }
}

async function persistSqlEditorToIdb(state: {
  activeConnectionId: string | null
  sqlTabs: SqlEditorTab[]
  activeSqlTabId: string | null
}): Promise<void> {
  if (!state.activeConnectionId || !state.activeSqlTabId || state.sqlTabs.length === 0) {
    return
  }

  const workspace: SqlEditorWorkspace = {
    connectionId: state.activeConnectionId,
    activeSqlTabId: state.activeSqlTabId,
    tabs: state.sqlTabs,
    updatedAt: Date.now()
  }

  await saveSqlEditorWorkspace(workspace)
}

function schedulePersistSqlEditor(get: () => AppState): void {
  if (persistSqlEditorTimer) {
    clearTimeout(persistSqlEditorTimer)
  }

  persistSqlEditorTimer = setTimeout(() => {
    persistSqlEditorTimer = null
    void persistSqlEditorToIdb(get())
  }, 300)
}

async function hydrateSqlEditorWorkspace(
  connectionId: string,
  get: () => AppState,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void
): Promise<void> {
  const stored = await loadSqlEditorWorkspace(connectionId)
  const current = get()

  if (current.activeConnectionId !== connectionId) {
    return
  }

  if (stored && stored.tabs.length > 0) {
    const activeSqlTabId = stored.tabs.some((tab) => tab.id === stored.activeSqlTabId)
      ? stored.activeSqlTabId
      : stored.tabs[0].id

    const workspace = snapshotWorkspace({
      ...normalizeWorkspace(current.workspaces[connectionId]),
      sqlTabs: stored.tabs,
      activeSqlTabId
    })

    set({
      sqlTabs: workspace.sqlTabs,
      activeSqlTabId: workspace.activeSqlTabId,
      workspaces: persistWorkspace(current.workspaces, connectionId, workspace)
    })
    return
  }

  const workspace = normalizeWorkspace(current.workspaces[connectionId])
  await persistSqlEditorToIdb({
    activeConnectionId: connectionId,
    sqlTabs: workspace.sqlTabs,
    activeSqlTabId: workspace.activeSqlTabId
  })
}

function resolveInitialConnectionId(connections: PublicConnection[]): string | null {
  if (connections.length === 0) {
    return null
  }

  const saved = readLastConnectionId()
  if (saved && connections.some((connection) => connection.id === saved)) {
    return saved
  }

  return connections[0].id
}

interface AppState {
  connections: PublicConnection[]
  activeSessionId: string | null
  activeConnectionId: string | null
  activeDbType: DbType | null
  connectionStatus: ConnectionStatus
  connectAttempt: number
  selectedTable: SelectedTable | null
  columns: ColumnInfo[]
  ddl: string
  workspaces: Record<string, ConnectionWorkspace>
  sqlTabs: SqlEditorTab[]
  activeSqlTabId: string | null
  resultTabs: QueryResultTab[]
  activeResultTabId: string | null
  sqlHistory: SqlHistoryEntry[]
  loadingConnections: boolean
  loadingSchema: boolean
  loadingQuery: boolean
  setConnections: (connections: PublicConnection[]) => void
  selectConnection: (connectionId: string) => void
  restoreInitialConnection: (connections: PublicConnection[]) => void
  establishSession: (sessionId: string, dbType: DbType) => void
  clearSession: () => void
  setConnectionStatus: (status: ConnectionStatus, attempt?: number) => void
  setSelectedTable: (table: SelectedTable | null) => void
  setColumns: (columns: ColumnInfo[]) => void
  setDdl: (ddl: string) => void
  addResultTab: (sql: string, result: QueryResult) => void
  removeResultTab: (id: string) => void
  setActiveResultTabId: (id: string | null) => void
  addSqlTab: () => void
  insertSqlTab: (relativeToId: string, position: 'before' | 'after') => void
  removeSqlTab: (id: string) => void
  setActiveSqlTabId: (id: string) => void
  renameSqlTab: (id: string, title: string) => void
  setSql: (sql: string) => void
  setSqlTabSql: (id: string, sql: string) => void
  loadSqlHistory: (connectionId: string) => Promise<void>
  addSqlHistoryEntry: (payload: {
    sql: string
    result: QueryResult
    durationMs: number
  }) => Promise<void>
  removeSqlHistoryEntry: (id: string) => Promise<void>
  clearSqlHistory: () => Promise<void>
  clearWorkspace: (connectionId: string) => Promise<void>
  deselectConnection: () => void
  setLoadingConnections: (loading: boolean) => void
  setLoadingSchema: (loading: boolean) => void
  setLoadingQuery: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  connections: [],
  activeSessionId: null,
  activeConnectionId: null,
  activeDbType: null,
  connectionStatus: 'idle',
  connectAttempt: 0,
  selectedTable: null,
  columns: [],
  ddl: '',
  workspaces: {},
  sqlTabs: emptyWorkspace().sqlTabs,
  activeSqlTabId: emptyWorkspace().activeSqlTabId,
  resultTabs: [],
  activeResultTabId: null,
  sqlHistory: [],
  loadingConnections: false,
  loadingSchema: false,
  loadingQuery: false,
  setConnections: (connections) => set({ connections }),
  selectConnection: (connectionId) => {
    const state = get()
    if (
      state.activeConnectionId === connectionId &&
      state.connectionStatus === 'connected' &&
      state.activeSessionId
    ) {
      return
    }

    const hadPersistedWorkspace = Boolean(state.workspaces[connectionId]?.sqlTabs?.length)

    set((current) => {
      let workspaces = current.workspaces

      if (current.activeConnectionId) {
        workspaces = persistWorkspace(
          workspaces,
          current.activeConnectionId,
          snapshotWorkspace(current)
        )
      }

      const nextWorkspace = normalizeWorkspace(workspaces[connectionId])

      return {
        activeConnectionId: connectionId,
        activeSessionId: null,
        activeDbType: null,
        connectionStatus: 'idle' as ConnectionStatus,
        connectAttempt: 0,
        selectedTable: null,
        columns: [],
        ddl: '',
        workspaces,
        sqlHistory: [],
        ...applyWorkspace(nextWorkspace)
      }
    })

    void get().loadSqlHistory(connectionId)

    if (hadPersistedWorkspace) {
      void persistSqlEditorToIdb(get())
    } else {
      void hydrateSqlEditorWorkspace(connectionId, get, set)
    }

    startConnect(connectionId)
    writeLastConnectionId(connectionId)
  },
  restoreInitialConnection: (connections) => {
    const targetId = resolveInitialConnectionId(connections)
    if (!targetId) {
      get().deselectConnection()
      return
    }

    get().selectConnection(targetId)
  },
  establishSession: (sessionId, dbType) =>
    set({
      activeSessionId: sessionId,
      activeDbType: dbType,
      connectionStatus: 'connected'
    }),
  clearSession: () =>
    set({
      activeSessionId: null,
      activeDbType: null,
      connectionStatus: 'idle',
      connectAttempt: 0,
      selectedTable: null,
      columns: [],
      ddl: ''
    }),
  setConnectionStatus: (status, attempt = 0) =>
    set({
      connectionStatus: status,
      connectAttempt: attempt
    }),
  setSelectedTable: (table) => set({ selectedTable: table }),
  setColumns: (columns) => set({ columns }),
  setDdl: (ddl) => set({ ddl }),
  addResultTab: (sql, result) =>
    set((state) => {
      const id = crypto.randomUUID()
      const tab: QueryResultTab = { id, sql, createdAt: Date.now(), result }
      const resultTabs = [...state.resultTabs, tab]
      const activeResultTabId = id
      const workspace = snapshotWorkspace({ ...state, resultTabs, activeResultTabId })

      return {
        resultTabs,
        activeResultTabId,
        workspaces: persistWorkspace(state.workspaces, state.activeConnectionId, workspace)
      }
    }),
  removeResultTab: (id) =>
    set((state) => {
      const resultTabs = state.resultTabs.filter((tab) => tab.id !== id)
      let activeResultTabId = state.activeResultTabId

      if (activeResultTabId === id) {
        const removedIndex = state.resultTabs.findIndex((tab) => tab.id === id)
        const nextTab = resultTabs[removedIndex] ?? resultTabs[removedIndex - 1] ?? null
        activeResultTabId = nextTab?.id ?? null
      }

      const workspace = snapshotWorkspace({ ...state, resultTabs, activeResultTabId })

      return {
        resultTabs,
        activeResultTabId,
        workspaces: persistWorkspace(state.workspaces, state.activeConnectionId, workspace)
      }
    }),
  setActiveResultTabId: (id) =>
    set((state) => {
      const workspace = snapshotWorkspace({ ...state, activeResultTabId: id })

      return {
        activeResultTabId: id,
        workspaces: persistWorkspace(state.workspaces, state.activeConnectionId, workspace)
      }
    }),
  addSqlTab: () =>
    set((state) => {
      const tab = createDefaultSqlTab(nextSqlTabTitle(state.sqlTabs))
      const sqlTabs = [...state.sqlTabs, tab]
      const activeSqlTabId = tab.id
      const workspace = snapshotWorkspace({ ...state, sqlTabs, activeSqlTabId })

      void persistSqlEditorToIdb({
        activeConnectionId: state.activeConnectionId,
        sqlTabs,
        activeSqlTabId
      })

      return {
        sqlTabs,
        activeSqlTabId,
        workspaces: persistWorkspace(state.workspaces, state.activeConnectionId, workspace)
      }
    }),
  insertSqlTab: (relativeToId, position) =>
    set((state) => {
      const index = state.sqlTabs.findIndex((tab) => tab.id === relativeToId)
      if (index < 0) {
        return state
      }

      const tab = createDefaultSqlTab(nextSqlTabTitle(state.sqlTabs))
      const insertIndex = position === 'before' ? index : index + 1
      const sqlTabs = [
        ...state.sqlTabs.slice(0, insertIndex),
        tab,
        ...state.sqlTabs.slice(insertIndex)
      ]
      const activeSqlTabId = tab.id
      const workspace = snapshotWorkspace({ ...state, sqlTabs, activeSqlTabId })

      void persistSqlEditorToIdb({
        activeConnectionId: state.activeConnectionId,
        sqlTabs,
        activeSqlTabId
      })

      return {
        sqlTabs,
        activeSqlTabId,
        workspaces: persistWorkspace(state.workspaces, state.activeConnectionId, workspace)
      }
    }),
  removeSqlTab: (id) =>
    set((state) => {
      if (state.sqlTabs.length <= 1) {
        return state
      }

      const sqlTabs = state.sqlTabs.filter((tab) => tab.id !== id)
      let activeSqlTabId = state.activeSqlTabId

      if (activeSqlTabId === id) {
        const removedIndex = state.sqlTabs.findIndex((tab) => tab.id === id)
        const nextTab = sqlTabs[removedIndex] ?? sqlTabs[removedIndex - 1] ?? sqlTabs[0]
        activeSqlTabId = nextTab?.id ?? null
      }

      const workspace = snapshotWorkspace({ ...state, sqlTabs, activeSqlTabId })

      void persistSqlEditorToIdb({
        activeConnectionId: state.activeConnectionId,
        sqlTabs,
        activeSqlTabId
      })

      return {
        sqlTabs,
        activeSqlTabId,
        workspaces: persistWorkspace(state.workspaces, state.activeConnectionId, workspace)
      }
    }),
  setActiveSqlTabId: (id) =>
    set((state) => {
      if (!state.sqlTabs.some((tab) => tab.id === id)) {
        return state
      }

      const workspace = snapshotWorkspace({ ...state, activeSqlTabId: id })

      void persistSqlEditorToIdb({
        activeConnectionId: state.activeConnectionId,
        sqlTabs: state.sqlTabs,
        activeSqlTabId: id
      })

      return {
        activeSqlTabId: id,
        workspaces: persistWorkspace(state.workspaces, state.activeConnectionId, workspace)
      }
    }),
  renameSqlTab: (id, title) =>
    set((state) => {
      const trimmed = title.trim()
      if (!trimmed) {
        return state
      }

      const sqlTabs = state.sqlTabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              title: trimmed
            }
          : tab
      )
      const workspace = snapshotWorkspace({ ...state, sqlTabs })

      void persistSqlEditorToIdb({
        activeConnectionId: state.activeConnectionId,
        sqlTabs,
        activeSqlTabId: state.activeSqlTabId
      })

      return {
        sqlTabs,
        workspaces: persistWorkspace(state.workspaces, state.activeConnectionId, workspace)
      }
    }),
  setSql: (sql) => {
    const state = get()
    const activeSqlTabId = state.activeSqlTabId
    if (!activeSqlTabId) return

    set((current) => {
      const sqlTabs = current.sqlTabs.map((tab) =>
        tab.id === activeSqlTabId ? { ...tab, sql } : tab
      )
      const workspace = snapshotWorkspace({ ...current, sqlTabs })

      schedulePersistSqlEditor(get)

      return {
        sqlTabs,
        workspaces: persistWorkspace(current.workspaces, current.activeConnectionId, workspace)
      }
    })
  },
  setSqlTabSql: (id, sql) => {
    set((state) => {
      const sqlTabs = state.sqlTabs.map((tab) => (tab.id === id ? { ...tab, sql } : tab))
      const workspace = snapshotWorkspace({ ...state, sqlTabs })

      schedulePersistSqlEditor(get)

      return {
        sqlTabs,
        workspaces: persistWorkspace(state.workspaces, state.activeConnectionId, workspace)
      }
    })
  },
  loadSqlHistory: async (connectionId) => {
    const entries = await listSqlHistory(connectionId)
    set({ sqlHistory: entries })
  },
  addSqlHistoryEntry: async ({ sql, result, durationMs }) => {
    const connectionId = get().activeConnectionId
    if (!connectionId) return

    const entry = buildSqlHistoryEntry(connectionId, sql, result, durationMs)
    await persistSqlHistoryEntry(entry)
    set((state) => ({
      sqlHistory: [entry, ...state.sqlHistory.filter((item) => item.id !== entry.id)].slice(0, 200)
    }))
  },
  removeSqlHistoryEntry: async (id) => {
    await deletePersistedSqlHistoryEntry(id)
    set((state) => ({
      sqlHistory: state.sqlHistory.filter((entry) => entry.id !== id)
    }))
  },
  clearSqlHistory: async () => {
    const connectionId = get().activeConnectionId
    if (!connectionId) return

    await clearPersistedSqlHistory(connectionId)
    set({ sqlHistory: [] })
  },
  clearWorkspace: async (connectionId) => {
    await clearPersistedSqlHistory(connectionId)
    await deleteSqlEditorWorkspace(connectionId)
    set((state) => {
      const workspaces = { ...state.workspaces }
      delete workspaces[connectionId]
      const sqlHistory =
        state.activeConnectionId === connectionId ? [] : state.sqlHistory
      const resetEditor =
        state.activeConnectionId === connectionId
          ? applyWorkspace(emptyWorkspace())
          : {
              sqlTabs: state.sqlTabs,
              activeSqlTabId: state.activeSqlTabId
            }
      return { workspaces, sqlHistory, ...resetEditor }
    })
  },
  deselectConnection: () => {
    clearLastConnectionId()
    set((state) => {
      let workspaces = state.workspaces
      if (state.activeConnectionId) {
        workspaces = persistWorkspace(
          workspaces,
          state.activeConnectionId,
          snapshotWorkspace(state)
        )
        void persistSqlEditorToIdb(state)
      }

      return {
        activeConnectionId: null,
        activeSessionId: null,
        activeDbType: null,
        connectionStatus: 'idle' as ConnectionStatus,
        connectAttempt: 0,
        selectedTable: null,
        columns: [],
        ddl: '',
        workspaces,
        sqlHistory: [],
        ...applyWorkspace(emptyWorkspace())
      }
    })
  },
  setLoadingConnections: (loading) => set({ loadingConnections: loading }),
  setLoadingSchema: (loading) => set({ loadingSchema: loading }),
  setLoadingQuery: (loading) => set({ loadingQuery: loading })
}))

export function createEmptyConnection(): ConnectionConfig {
  return {
    id: '',
    name: '',
    type: 'mysql',
    host: '127.0.0.1',
    port: 3306,
    username: 'root',
    password: '',
    database: '',
    ssl: false
  }
}
