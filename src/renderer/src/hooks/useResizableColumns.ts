import { useCallback, useMemo, useState } from 'react'
import type { ColumnsType, ColumnType } from 'antd/es/table'
import ResizableHeaderCell from '../components/ResizableHeaderCell'

function getColumnKey<T>(column: ColumnType<T>, index: number): string {
  if (column.key != null) return String(column.key)
  const dataIndex = column.dataIndex
  if (Array.isArray(dataIndex)) return dataIndex.join('.')
  if (dataIndex != null) return String(dataIndex)
  return String(index)
}

function getDefaultWidth<T>(column: ColumnType<T>): number {
  if (typeof column.width === 'number') return column.width
  const title = typeof column.title === 'string' ? column.title : ''
  return Math.min(240, Math.max(72, title.length * 9 + 24))
}

interface UseResizableColumnsOptions {
  minWidth?: number
  resetKey?: string
}

export function useResizableColumns<T extends object>(
  baseColumns: ColumnsType<T>,
  options?: UseResizableColumnsOptions
): {
  columns: ColumnsType<T>
  components: { header: { cell: typeof ResizableHeaderCell } }
  scrollX: number
} {
  const minWidth = options?.minWidth ?? 48
  const resetKey = options?.resetKey ?? ''
  const [widthsByTable, setWidthsByTable] = useState<Record<string, Record<string, number>>>({})
  const columnWidths = widthsByTable[resetKey]

  const setColumnWidth = useCallback(
    (key: string, width: number) => {
      setWidthsByTable((prev) => ({
        ...prev,
        [resetKey]: { ...prev[resetKey], [key]: width }
      }))
    },
    [resetKey]
  )

  const columns = useMemo(() => {
    const widths = columnWidths ?? {}

    return baseColumns.map((column, index) => {
      const key = getColumnKey(column, index)
      const width = widths[key] ?? getDefaultWidth(column)

      return {
        ...column,
        width,
        onHeaderCell: () => ({
          width,
          minWidth,
          onResize: (nextWidth: number) => setColumnWidth(key, nextWidth)
        })
      }
    })
  }, [baseColumns, columnWidths, minWidth, setColumnWidth])

  const scrollX = useMemo(() => {
    return columns.reduce(
      (sum, column) => sum + (typeof column.width === 'number' ? column.width : 120),
      0
    )
  }, [columns])

  const components = useMemo(
    () => ({
      header: {
        cell: ResizableHeaderCell
      }
    }),
    []
  )

  return { columns, components, scrollX }
}
