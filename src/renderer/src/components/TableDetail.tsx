import { Modal, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CodeOutlined, TableOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useAppStore } from '../stores/connection'
import { useResizableColumns } from '../hooks/useResizableColumns'
import AppButton from './AppButton'
import PanelHeader from './PanelHeader'
import EmptyState from './EmptyState'
import TableScrollShell from './TableScrollShell'

export default function TableDetail(): React.JSX.Element {
  const { selectedTable, columns, ddl } = useAppStore()
  const [ddlOpen, setDdlOpen] = useState(false)

  const baseColumns: ColumnsType<(typeof columns)[number]> = useMemo(
    () => [
      { title: 'Column', dataIndex: 'name', key: 'name', width: 100 },
      { title: 'Type', dataIndex: 'type', key: 'type', width: 100 },
      { title: 'Null', dataIndex: 'nullable', key: 'nullable', width: 44 },
      { title: 'Key', dataIndex: 'keyType', key: 'keyType', width: 44 },
      {
        title: 'Default',
        dataIndex: 'defaultValue',
        key: 'defaultValue',
        width: 90,
        ellipsis: true
      },
      { title: 'Extra', dataIndex: 'extra', key: 'extra', width: 80, ellipsis: true }
    ],
    []
  )

  const resetKey = selectedTable
    ? `${selectedTable.database ?? selectedTable.schema}.${selectedTable.table}`
    : ''

  const {
    columns: tableColumns,
    components,
    scrollX
  } = useResizableColumns(baseColumns, {
    resetKey,
    minWidth: 40
  })

  if (!selectedTable) {
    return (
      <div className="panel-section table-detail">
        <PanelHeader title="Structure" />
        <EmptyState
          icon={<TableOutlined />}
          title="No table selected"
          description="Select a table from the schema tree"
        />
      </div>
    )
  }

  const tableName = selectedTable.database
    ? `${selectedTable.database}.${selectedTable.table}`
    : `${selectedTable.schema}.${selectedTable.table}`

  return (
    <div className="panel-section table-detail">
      <PanelHeader
        title={tableName}
        extra={
          <AppButton variant="ghost" icon={<CodeOutlined />} onClick={() => setDdlOpen(true)}>
            DDL
          </AppButton>
        }
      />

      <TableScrollShell refreshKey={`${resetKey}-${columns.length}`}>
        <Table
          className="app-table--compact"
          size="small"
          bordered={false}
          tableLayout="fixed"
          pagination={false}
          components={components}
          scroll={{ x: scrollX, y: 180 }}
          rowKey="name"
          dataSource={columns}
          columns={tableColumns}
        />
      </TableScrollShell>

      <Modal
        title="Table DDL"
        open={ddlOpen}
        onCancel={() => setDdlOpen(false)}
        footer={null}
        width={720}
      >
        <div className="ddl-modal-table-name">{tableName}</div>
        <pre className="ddl-preview">{ddl}</pre>
      </Modal>
    </div>
  )
}
