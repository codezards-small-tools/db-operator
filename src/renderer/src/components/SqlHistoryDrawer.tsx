import { useEffect, useRef } from 'react'
import { Drawer, Popconfirm, message } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  UploadOutlined
} from '@ant-design/icons'
import type { SqlHistoryEntry } from '../../../shared/types'
import { useAppStore } from '../stores/connection'
import AppButton from './AppButton'
import EmptyState from './EmptyState'

interface SqlHistoryDrawerProps {
  open: boolean
  onClose: () => void
  onExecute: (sql: string) => void
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return new Date(timestamp).toLocaleString()
}

function formatSummary(entry: SqlHistoryEntry): string {
  if (!entry.success) {
    return entry.error ? `Failed · ${entry.error}` : 'Failed'
  }

  if (entry.rowCount != null) {
    return `${entry.rowCount} row(s)`
  }

  if (entry.affectedRows != null) {
    return `${entry.affectedRows} affected`
  }

  return 'Success'
}

function formatSqlPreview(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ')
}

export default function SqlHistoryDrawer({
  open,
  onClose,
  onExecute
}: SqlHistoryDrawerProps): React.JSX.Element {
  const {
    activeConnectionId,
    sqlHistory,
    setSql,
    removeSqlHistoryEntry,
    clearSqlHistory,
    loadSqlHistory
  } = useAppStore()

  const openedForConnectionRef = useRef<string | null>(null)

  useEffect(() => {
    if (open && activeConnectionId) {
      void loadSqlHistory(activeConnectionId)
    }
  }, [open, activeConnectionId, loadSqlHistory])

  useEffect(() => {
    if (!open) {
      openedForConnectionRef.current = null
      return
    }

    if (
      openedForConnectionRef.current &&
      openedForConnectionRef.current !== activeConnectionId
    ) {
      onClose()
    }

    openedForConnectionRef.current = activeConnectionId
  }, [open, activeConnectionId, onClose])

  const handleLoad = (sql: string): void => {
    setSql(sql)
    onClose()
  }

  const handleRun = (sql: string): void => {
    setSql(sql)
    onExecute(sql)
    onClose()
  }

  const handleCopy = async (sql: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(sql)
      message.success('SQL copied')
    } catch {
      message.error('Failed to copy SQL')
    }
  }

  const handleClear = async (): Promise<void> => {
    await clearSqlHistory()
    message.success('History cleared')
  }

  return (
    <Drawer
      title="SQL History"
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        activeConnectionId ? (
          <Popconfirm
            title="Clear all history for this connection?"
            onConfirm={() => void handleClear()}
            okText="Clear"
            cancelText="Cancel"
          >
            <AppButton variant="ghost" disabled={sqlHistory.length === 0}>
              Clear history
            </AppButton>
          </Popconfirm>
        ) : null
      }
    >
      {!activeConnectionId ? (
        <EmptyState
          icon={<HistoryOutlined />}
          title="No connection selected"
          description="Select a connection to view SQL history"
        />
      ) : sqlHistory.length === 0 ? (
        <EmptyState
          icon={<HistoryOutlined />}
          title="No history yet"
          description="Executed SQL statements will appear here"
        />
      ) : (
        <ul className="sql-history-list">
          {sqlHistory.map((entry) => (
            <li key={entry.id} className="sql-history-item">
              <div className="sql-history-item__header">
                <span
                  className={`sql-history-item__status ${
                    entry.success
                      ? 'sql-history-item__status--success'
                      : 'sql-history-item__status--error'
                  }`}
                >
                  {entry.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                </span>
                <span className="sql-history-item__time">{formatRelativeTime(entry.executedAt)}</span>
                <span className="sql-history-item__duration">{entry.durationMs}ms</span>
                <span className="sql-history-item__summary">{formatSummary(entry)}</span>
              </div>
              <div className="sql-history-item__sql" title={entry.sql}>
                {formatSqlPreview(entry.sql)}
              </div>
              <div className="sql-history-item__actions">
                <AppButton
                  variant="ghost"
                  icon={<UploadOutlined />}
                  onClick={() => handleLoad(entry.sql)}
                >
                  Load
                </AppButton>
                <AppButton
                  variant="ghost"
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleRun(entry.sql)}
                >
                  Run
                </AppButton>
                <AppButton
                  variant="ghost"
                  icon={<CopyOutlined />}
                  onClick={() => void handleCopy(entry.sql)}
                >
                  Copy
                </AppButton>
                <AppButton
                  variant="icon"
                  icon={<DeleteOutlined />}
                  aria-label="Delete history entry"
                  onClick={() => void removeSqlHistoryEntry(entry.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}
