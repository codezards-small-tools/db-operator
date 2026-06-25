import { Modal, Tabs } from 'antd'

interface CellValueDetailModalProps {
  open: boolean
  column: string
  value: unknown
  onClose: () => void
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

function formatTextValue(value: unknown): string {
  if (value === undefined || value === null) return 'NULL'

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, jsonReplacer, 2)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

function formatJsonValue(value: unknown): string {
  if (value === undefined || value === null) return 'null'

  try {
    return JSON.stringify(value, jsonReplacer, 2)
  } catch {
    return JSON.stringify(String(value))
  }
}

export default function CellValueDetailModal({
  open,
  column,
  value,
  onClose
}: CellValueDetailModalProps): React.JSX.Element {
  const textContent = formatTextValue(value)
  const jsonContent = formatJsonValue(value)

  return (
    <Modal title={column} open={open} onCancel={onClose} footer={null} width={720}>
      <Tabs
        size="small"
        items={[
          {
            key: 'text',
            label: 'Text',
            children: <pre className="cell-detail-preview">{textContent}</pre>
          },
          {
            key: 'json',
            label: 'JSON',
            children: <pre className="cell-detail-preview">{jsonContent}</pre>
          }
        ]}
      />
    </Modal>
  )
}
