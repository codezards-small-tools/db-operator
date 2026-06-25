import { Layout, message } from 'antd'
import { useEffect, useState } from 'react'
import SqlEditor from './components/SqlEditor'
import ConnectionList from './components/ConnectionList'
import SchemaTree from './components/SchemaTree'
import TableDetail from './components/TableDetail'
import ResultGrid from './components/ResultGrid'
import AppHeader from './components/AppHeader'
import ResizableMainContent from './components/ResizableMainContent'
import ResizableSider from './components/ResizableSider'
import { useAppStore } from './stores/connection'
import { ensureConnected } from './services/connection-session'
import { isWebPreviewMode } from './dev/web-preview'
import { detectFramelessWindows } from './utils/window-chrome'

const { Content } = Layout

function App(): React.JSX.Element {
  const { activeConnectionId, addResultTab, addSqlHistoryEntry, setLoadingQuery } = useAppStore()
  const [framelessWin, setFramelessWin] = useState(false)

  useEffect(() => {
    void detectFramelessWindows().then(setFramelessWin)
  }, [])

  const handleExecute = async (sqlToRun: string): Promise<void> => {
    if (!sqlToRun.trim()) {
      message.warning('Please enter a SQL statement')
      return
    }

    const sessionId = await ensureConnected()
    if (!sessionId) {
      message.warning('Unable to connect to database')
      return
    }

    setLoadingQuery(true)
    const started = performance.now()
    try {
      const result = await window.dbApi.query.execute(sessionId, sqlToRun)
      const durationMs = Math.round(performance.now() - started)
      await addSqlHistoryEntry({ sql: sqlToRun, result, durationMs })
      addResultTab(sqlToRun, result)
      if (!result.success) {
        message.error(result.error || 'Query failed')
      }
    } catch (error) {
      const durationMs = Math.round(performance.now() - started)
      const errorMessage = error instanceof Error ? error.message : 'Query failed'
      const result = { success: false as const, error: errorMessage }
      await addSqlHistoryEntry({ sql: sqlToRun, result, durationMs })
      addResultTab(sqlToRun, result)
      message.error(errorMessage)
    } finally {
      setLoadingQuery(false)
    }
  }

  const webPreview = isWebPreviewMode()
  const layoutClassName = [
    'app-layout',
    webPreview ? 'app-layout--web-preview' : '',
    framelessWin ? 'app-layout--frameless-win' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Layout className={layoutClassName}>
      {webPreview ? (
        <div className="web-preview-banner">Web Preview — 样式调试模式（dbApi 已 mock）</div>
      ) : null}
      <Layout className="app-shell">
        <AppHeader frameless={framelessWin} />
        <Layout className="app-shell__body" hasSider>
          <ResizableSider>
            <ConnectionList />
            <SchemaTree key={activeConnectionId ?? 'none'} />
            <TableDetail />
          </ResizableSider>
          <Content className="main-content-wrapper">
            <ResizableMainContent
              editor={<SqlEditor onExecute={(sqlToRun) => void handleExecute(sqlToRun)} />}
              results={<ResultGrid />}
            />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}

export default App
