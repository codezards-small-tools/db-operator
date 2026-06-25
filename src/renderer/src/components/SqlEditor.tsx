import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { Space, Tabs } from 'antd'
import { HistoryOutlined, PlayCircleOutlined, DatabaseOutlined } from '@ant-design/icons'
import { useAppStore } from '../stores/connection'
import { useThemeStore } from '../stores/theme'
import AppButton from './AppButton'
import PanelHeader from './PanelHeader'
import SqlHistoryDrawer from './SqlHistoryDrawer'
import SqlEditorTabLabel from './SqlEditorTabLabel'
import EmptyState from './EmptyState'

interface SqlEditorProps {
  onExecute: (sql: string) => void
}

function getExecutableSql(editorInstance: editor.IStandaloneCodeEditor): string {
  const model = editorInstance.getModel()
  const selection = editorInstance.getSelection()

  if (model && selection && !selection.isEmpty()) {
    return model.getValueInRange(selection).trim()
  }

  return editorInstance.getValue().trim()
}

export default function SqlEditor({ onExecute }: SqlEditorProps): React.JSX.Element {
  const {
    sqlTabs,
    activeSqlTabId,
    activeDbType,
    activeConnectionId,
    activeSessionId,
    connectionStatus,
    loadingQuery,
    addSqlTab,
    insertSqlTab,
    removeSqlTab,
    setActiveSqlTabId,
    renameSqlTab,
    setSqlTabSql
  } = useAppStore()
  const themeMode = useThemeStore((state) => state.theme)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const onExecuteRef = useRef(onExecute)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    onExecuteRef.current = onExecute
  }, [onExecute])

  const activeTab = useMemo(
    () => sqlTabs.find((tab) => tab.id === activeSqlTabId) ?? sqlTabs[0] ?? null,
    [sqlTabs, activeSqlTabId]
  )

  const language = useMemo(() => {
    return activeDbType === 'postgresql' ? 'pgsql' : 'mysql'
  }, [activeDbType])

  const monacoTheme = themeMode === 'dark' ? 'vs-dark' : 'vs'
  const isConnecting = connectionStatus === 'connecting' || connectionStatus === 'retrying'
  const canRun =
    Boolean(activeConnectionId) && connectionStatus === 'connected' && Boolean(activeSessionId)

  const runQuery = useCallback(() => {
    const { activeSessionId, connectionStatus } = useAppStore.getState()
    if (connectionStatus !== 'connected' || !activeSessionId) return

    const editorInstance = editorRef.current
    const sqlToRun = editorInstance
      ? getExecutableSql(editorInstance)
      : (activeTab?.sql ?? '').trim()
    onExecuteRef.current(sqlToRun)
  }, [activeTab?.sql])

  const handleTabEdit = (
    targetKey: string | React.MouseEvent | React.KeyboardEvent,
    action: 'add' | 'remove'
  ): void => {
    if (action === 'add') {
      addSqlTab()
      return
    }

    if (typeof targetKey === 'string') {
      removeSqlTab(targetKey)
    }
  }

  return (
    <div className={`sql-editor-panel ${activeConnectionId ? '' : 'sql-editor-panel--disabled'}`}>
      <PanelHeader
        title="SQL"
        extra={
          <Space size={8}>
            <AppButton
              variant="ghost"
              icon={<HistoryOutlined />}
              disabled={!activeConnectionId}
              onClick={() => setHistoryOpen(true)}
            >
              History
            </AppButton>
            <kbd className="kbd-hint">Ctrl+Enter</kbd>
            <AppButton
              variant="primary"
              icon={<PlayCircleOutlined />}
              disabled={!canRun}
              loading={loadingQuery || isConnecting}
              onClick={runQuery}
            >
              Run
            </AppButton>
          </Space>
        }
      />
      <SqlHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onExecute={onExecute}
      />
      {activeConnectionId ? (
        <>
          <Tabs
            type="editable-card"
            size="small"
            className="sql-editor-tabs sql-editor-tabs--nav-only"
            activeKey={activeSqlTabId ?? undefined}
            onChange={(key) => setActiveSqlTabId(key)}
            onEdit={handleTabEdit}
            items={sqlTabs.map((tab, index) => ({
              key: tab.id,
              label: (
                <SqlEditorTabLabel
                  title={tab.title}
                  fallbackTitle={`Query ${index + 1}`}
                  closable={sqlTabs.length > 1}
                  onRename={(title) => renameSqlTab(tab.id, title)}
                  onClose={() => removeSqlTab(tab.id)}
                  onInsertLeft={() => insertSqlTab(tab.id, 'before')}
                  onInsertRight={() => insertSqlTab(tab.id, 'after')}
                />
              ),
              closable: sqlTabs.length > 1,
              children: null
            }))}
          />
          <div className="monaco-wrapper">
            {activeTab ? (
              <Editor
                key={`${activeConnectionId}:${activeTab.id}`}
                height="100%"
                width="100%"
                loading={null}
                language={language}
                theme={monacoTheme}
                value={activeTab.sql}
                onChange={(value) => setSqlTabSql(activeTab.id, value ?? '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 8 }
                }}
                    onMount={(editorInstance, monaco) => {
                      editorRef.current = editorInstance
                      editorInstance.addCommand(
                        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                        () => {
                          runQuery()
                        }
                      )
                    }}
              />
            ) : null}
          </div>
        </>
      ) : (
        <div className="sql-editor-empty">
          <EmptyState
            icon={<DatabaseOutlined />}
            title="No connection selected"
            description="Create or select a connection to write SQL"
          />
        </div>
      )}
    </div>
  )
}
