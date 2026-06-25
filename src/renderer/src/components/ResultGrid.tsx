import { useCallback, useMemo, useState } from 'react'
import { Alert, Table, Tabs } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { TableOutlined } from '@ant-design/icons'
import type { QueryResult } from '../../../shared/types'
import { useAppStore, type QueryResultTab } from '../stores/connection'
import { useResizableColumns } from '../hooks/useResizableColumns'
import CellValueDetailModal from './CellValueDetailModal'
import TableScrollShell from './TableScrollShell'
import EmptyState from './EmptyState'

interface CellDetailState {
  column: string
  value: unknown
}

function defaultColumnWidth(name: string): number {
  return Math.min(220, Math.max(72, name.length * 9 + 20))
}

function formatTabLabel(tab: QueryResultTab): string {
  const sqlPreview = tab.sql.trim().replace(/\s+/g, ' ')
  const truncated = sqlPreview.length > 26 ? `${sqlPreview.slice(0, 26)}…` : sqlPreview

  if (!tab.result.success) {
    return `✗ ${truncated}`
  }

  if (tab.result.rows) {
    return `${truncated} (${tab.result.rows.length})`
  }

  const affected = tab.result.affectedRows ?? 0
  return `${truncated} (${affected} affected)`
}

function QueryResultTable({ result }: { result: QueryResult }): React.JSX.Element {
  const fields = result.fields
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [cellDetail, setCellDetail] = useState<CellDetailState | null>(null)
  const totalRows = result.rows?.length ?? 0

  const openCellDetail = useCallback((column: string, value: unknown) => {
    setCellDetail({ column, value })
  }, [])

  const baseColumns: ColumnsType<Record<string, unknown>> = useMemo(() => {
    if (!fields || fields.length === 0) return []

    return fields.map((field) => ({
      title: field.name,
      dataIndex: field.name,
      key: field.name,
      ellipsis: true,
      width: defaultColumnWidth(field.name),
      onCell: (record: Record<string, unknown>) => ({
        onDoubleClick: (event: React.MouseEvent<HTMLTableCellElement>) => {
          event.stopPropagation()
          openCellDetail(field.name, record[field.name])
        }
      }),
      render: (value: unknown) => {
        if (value == null) {
          return <span className="cell-null">NULL</span>
        }
        if (typeof value === 'object') return JSON.stringify(value)
        return String(value)
      }
    }))
  }, [fields, openCellDetail])

  const resetKey = fields?.map((field) => field.name).join('\0') ?? ''
  const { columns, components, scrollX } = useResizableColumns(baseColumns, { resetKey })

  return (
    <div className="result-table-view">
      <div className="result-table-view__main">
        {result.message ? (
          <Alert
            type={result.truncated ? 'warning' : 'info'}
            message={result.message}
            showIcon
            className="result-panel__alert"
          />
        ) : null}
        <TableScrollShell refreshKey={resetKey}>
          <Table
            className="app-table--compact"
            size="small"
            bordered={false}
            tableLayout="fixed"
            components={components}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys)
            }}
            pagination={{ pageSize: 50, showSizeChanger: true, size: 'small' }}
            scroll={{ x: scrollX, y: 'calc(100vh - 652px)' }}
            rowKey={(_, index) => String(index)}
            columns={columns}
            dataSource={result.rows}
          />
        </TableScrollShell>
      </div>
      <div className="result-toolbar">
        <span className="result-toolbar__text">
          {selectedRowKeys.length > 0
            ? `${selectedRowKeys.length} of ${totalRows} row(s) selected`
            : `${totalRows} row(s)`}
        </span>
        {selectedRowKeys.length > 0 ? (
          <button
            type="button"
            className="result-toolbar__action"
            onClick={() => setSelectedRowKeys([])}
          >
            Clear selection
          </button>
        ) : null}
      </div>

      <CellValueDetailModal
        open={cellDetail != null}
        column={cellDetail?.column ?? ''}
        value={cellDetail?.value}
        onClose={() => setCellDetail(null)}
      />
    </div>
  )
}

function QueryResultContent({ result }: { result: QueryResult }): React.JSX.Element {
  if (!result.success) {
    return (
      <div className="result-tab-message">
        <Alert type="error" message="Query failed" description={result.error} showIcon />
      </div>
    )
  }

  if (result.rows) {
    const tableKey = `${result.fields?.map((field) => field.name).join('\0')}:${result.rows.length}`
    return <QueryResultTable key={tableKey} result={result} />
  }

  return (
    <div className="result-tab-message">
      <Alert
        type="success"
        message={result.message || `${result.affectedRows ?? 0} row(s) affected`}
        showIcon
      />
    </div>
  )
}

export default function ResultGrid(): React.JSX.Element {
  const { resultTabs, activeResultTabId, setActiveResultTabId, removeResultTab } = useAppStore()

  if (resultTabs.length === 0) {
    return (
      <div className="result-panel empty">
        <EmptyState
          icon={<TableOutlined />}
          title="No results yet"
          description="Execute a query to see results here"
        />
      </div>
    )
  }

  return (
    <div className="result-panel result-panel--tabs">
      <Tabs
        type="editable-card"
        hideAdd
        size="small"
        className="result-tabs"
        activeKey={activeResultTabId ?? undefined}
        onChange={(key) => setActiveResultTabId(key)}
        onEdit={(targetKey, action) => {
          if (action === 'remove' && typeof targetKey === 'string') {
            removeResultTab(targetKey)
          }
        }}
        items={resultTabs.map((tab) => ({
          key: tab.id,
          label: formatTabLabel(tab),
          closable: true,
          children: (
            <div className="result-tab-content">
              <QueryResultContent result={tab.result} />
            </div>
          )
        }))}
      />
    </div>
  )
}
