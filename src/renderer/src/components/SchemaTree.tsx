import { useCallback, useEffect, useState } from 'react'
import { Spin, Tree, message } from 'antd'
import type { DataNode, EventDataNode } from 'antd/es/tree'
import { DatabaseOutlined, FolderOpenOutlined, TableOutlined } from '@ant-design/icons'
import { useAppStore } from '../stores/connection'
import { ensureConnected } from '../services/connection-session'
import PanelHeader from './PanelHeader'
import EmptyState from './EmptyState'

interface TreeNodeData extends DataNode {
  nodeType: 'database' | 'schema' | 'table'
  schema?: string
  database?: string
  table?: string
}

function makeNodeKey(parts: string[]): string {
  return parts.join('::')
}

export default function SchemaTree(): React.JSX.Element {
  const {
    activeSessionId,
    activeConnectionId,
    activeDbType,
    loadingSchema,
    setLoadingSchema,
    setSelectedTable,
    setColumns,
    setDdl
  } = useAppStore()

  const [treeData, setTreeData] = useState<TreeNodeData[]>([])
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [loadedKeys, setLoadedKeys] = useState<string[]>([])

  const resetTree = useCallback(() => {
    setTreeData([])
    setExpandedKeys([])
    setLoadedKeys([])
    setSelectedTable(null)
    setColumns([])
    setDdl('')
  }, [setColumns, setDdl, setSelectedTable])

  const loadRootNodes = useCallback(async () => {
    const sessionId = await ensureConnected()
    if (!sessionId) return

    const dbType = useAppStore.getState().activeDbType
    if (!dbType) return

    setLoadingSchema(true)
    try {
      if (dbType === 'mysql') {
        const result = await window.dbApi.schema.listDatabases(sessionId)
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to load databases')
        }
        setTreeData(
          result.data.map((database) => ({
            key: makeNodeKey(['db', database]),
            title: database,
            nodeType: 'database',
            database,
            isLeaf: false,
            icon: <DatabaseOutlined />
          }))
        )
      } else {
        const result = await window.dbApi.schema.listSchemas(sessionId)
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to load schemas')
        }
        setTreeData(
          result.data.map((schema) => ({
            key: makeNodeKey(['schema', schema]),
            title: schema,
            nodeType: 'schema',
            schema,
            isLeaf: false,
            icon: <DatabaseOutlined />
          }))
        )
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load schema')
      resetTree()
    } finally {
      setLoadingSchema(false)
    }
  }, [resetTree, setLoadingSchema])

  useEffect(() => {
    if (activeSessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async schema fetch on connect
      void loadRootNodes()
    }
  }, [activeSessionId, activeDbType, loadRootNodes])

  const updateTreeNode = (
    nodes: TreeNodeData[],
    key: string,
    children: TreeNodeData[]
  ): TreeNodeData[] => {
    return nodes.map((node) => {
      if (node.key === key) {
        return { ...node, children }
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeNode(node.children as TreeNodeData[], key, children)
        }
      }
      return node
    })
  }

  const onLoadData = async (node: EventDataNode<TreeNodeData>): Promise<void> => {
    const sessionId = await ensureConnected()
    if (!sessionId) return

    const dbType = useAppStore.getState().activeDbType
    if (!dbType) return

    const treeNode = node as TreeNodeData
    if (treeNode.children && treeNode.children.length > 0) return

    setLoadingSchema(true)
    try {
      if (dbType === 'mysql' && treeNode.nodeType === 'database' && treeNode.database) {
        const result = await window.dbApi.schema.listTables(
          sessionId,
          treeNode.database,
          treeNode.database
        )
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to load tables')
        }

        const children: TreeNodeData[] = result.data.map((table) => ({
          key: makeNodeKey(['db', treeNode.database!, 'table', table.name]),
          title: table.name,
          nodeType: 'table',
          database: treeNode.database,
          schema: treeNode.database,
          table: table.name,
          isLeaf: true,
          icon: <TableOutlined />
        }))

        setTreeData((current) => updateTreeNode(current, String(treeNode.key), children))
      }

      if (dbType === 'postgresql' && treeNode.nodeType === 'schema' && treeNode.schema) {
        const result = await window.dbApi.schema.listTables(sessionId, treeNode.schema)
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to load tables')
        }

        const children: TreeNodeData[] = result.data.map((table) => ({
          key: makeNodeKey(['schema', treeNode.schema!, 'table', table.name]),
          title: table.name,
          nodeType: 'table',
          schema: treeNode.schema,
          table: table.name,
          isLeaf: true,
          icon: <TableOutlined />
        }))

        setTreeData((current) => updateTreeNode(current, String(treeNode.key), children))
      }

      setLoadedKeys((keys) => [...new Set([...keys, String(treeNode.key)])])
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load children')
    } finally {
      setLoadingSchema(false)
    }
  }

  const handleSelect = async (
    _keys: React.Key[],
    info: { node: EventDataNode<TreeNodeData> }
  ): Promise<void> => {
    const node = info.node as TreeNodeData
    if (node.nodeType !== 'table' || !node.table || !node.schema) return

    const sessionId = await ensureConnected()
    if (!sessionId) return

    setSelectedTable({
      schema: node.schema,
      table: node.table,
      database: node.database
    })

    setLoadingSchema(true)
    try {
      const [columnsResult, ddlResult] = await Promise.all([
        window.dbApi.schema.getColumns(sessionId, node.schema, node.table, node.database),
        window.dbApi.schema.getDdl(sessionId, node.schema, node.table, node.database)
      ])

      if (!columnsResult.success || !columnsResult.data) {
        throw new Error(columnsResult.error || 'Failed to load columns')
      }
      if (!ddlResult.success || ddlResult.data == null) {
        throw new Error(ddlResult.error || 'Failed to load DDL')
      }

      setColumns(columnsResult.data)
      setDdl(ddlResult.data)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load table details')
    } finally {
      setLoadingSchema(false)
    }
  }

  return (
    <div className="panel-section schema-tree">
      <PanelHeader title="Schema" />
      <Spin spinning={loadingSchema}>
        {treeData.length === 0 ? (
          <EmptyState
            icon={<FolderOpenOutlined />}
            title={activeConnectionId ? 'No schema objects' : 'No connection selected'}
            description={
              activeConnectionId
                ? activeSessionId
                  ? 'No databases found'
                  : 'Connecting to database...'
                : 'Select a connection to browse schema'
            }
          />
        ) : (
          <Tree
            className="schema-tree-view"
            showIcon
            blockNode
            treeData={treeData}
            expandedKeys={expandedKeys}
            loadedKeys={loadedKeys}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            loadData={onLoadData}
            onSelect={(keys, info) => void handleSelect(keys, info)}
          />
        )}
      </Spin>
    </div>
  )
}
