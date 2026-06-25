import { useCallback, useEffect, useRef, useState } from 'react'
import { Popconfirm, Spin, message } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  DisconnectOutlined,
  DatabaseOutlined
} from '@ant-design/icons'
import type { PublicConnection } from '../../../preload/index'
import { useAppStore } from '../stores/connection'
import { disconnectCurrent, startConnect } from '../services/connection-session'
import AppButton from './AppButton'
import ConnectionForm from './ConnectionForm'
import PanelHeader from './PanelHeader'
import EmptyState from './EmptyState'

export default function ConnectionList(): React.JSX.Element {
  const {
    connections,
    activeConnectionId,
    activeSessionId,
    connectionStatus,
    loadingConnections,
    setConnections,
    selectConnection,
    restoreInitialConnection,
    clearWorkspace,
    deselectConnection,
    setLoadingConnections
  } = useAppStore()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PublicConnection | null>(null)
  const hasRestoredInitialConnection = useRef(false)

  const loadConnections = useCallback(async () => {
    setLoadingConnections(true)
    try {
      const items = await window.dbApi.connection.list()
      setConnections(items)

      const { activeConnectionId } = useAppStore.getState()

      if (!hasRestoredInitialConnection.current) {
        hasRestoredInitialConnection.current = true
        restoreInitialConnection(items)
      } else if (
        (activeConnectionId && !items.some((item) => item.id === activeConnectionId)) ||
        (!activeConnectionId && items.length > 0)
      ) {
        restoreInitialConnection(items)
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to load connections')
    } finally {
      setLoadingConnections(false)
    }
  }, [restoreInitialConnection, setConnections, setLoadingConnections])

  useEffect(() => {
    void loadConnections()
  }, [loadConnections])

  const handleDisconnect = async (): Promise<void> => {
    if (!activeSessionId && connectionStatus === 'idle') return
    await disconnectCurrent()
    message.info('Disconnected')
  }

  const handleRetryConnect = (connection: PublicConnection, event: React.MouseEvent): void => {
    event.stopPropagation()
    if (activeConnectionId !== connection.id) {
      selectConnection(connection.id)
      return
    }
    startConnect(connection.id)
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (activeConnectionId === id) {
      await disconnectCurrent()
      deselectConnection()
    }
    await window.dbApi.connection.delete(id)
    await clearWorkspace(id)
    message.success('Connection deleted')
    await loadConnections()
  }

  return (
    <div className="panel-section">
      <PanelHeader
        title="Connections"
        extra={
          <AppButton
            variant="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            New
          </AppButton>
        }
      />

      <Spin spinning={loadingConnections}>
        {connections.length === 0 && !loadingConnections ? (
          <EmptyState
            icon={<DatabaseOutlined />}
            title="No connections"
            description="Create a connection to get started"
          />
        ) : (
          <div>
            {connections.map((item) => {
              const isSelected = activeConnectionId === item.id
              const isConnected = isSelected && Boolean(activeSessionId)
              const isConnecting =
                isSelected && (connectionStatus === 'connecting' || connectionStatus === 'retrying')

              return (
                <div
                  key={item.id}
                  className={`connection-card ${isSelected ? 'connection-card--active' : ''}`}
                  onClick={() => selectConnection(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectConnection(item.id)
                    }
                  }}
                >
                  <span
                    className={`connection-card__ribbon ${item.type === 'mysql' ? 'connection-card__ribbon--mysql' : 'connection-card__ribbon--pg'}`}
                  >
                    {item.type === 'mysql' ? 'MySQL' : 'PG'}
                  </span>
                  <div className="connection-card__row">
                    <div className="connection-card__body">
                      <div className="connection-card__title">
                        <span>{item.name}</span>
                      </div>
                      <div className="connection-card__desc">
                        {item.username}@{item.host}:{item.port}
                      </div>
                    </div>
                    <div className="connection-card__actions">
                      <AppButton
                        variant="icon"
                        icon={
                          isConnected || isConnecting ? <DisconnectOutlined /> : <LinkOutlined />
                        }
                        onClick={(event) => {
                          event.stopPropagation()
                          if (isConnected || isConnecting) {
                            void handleDisconnect()
                          } else {
                            handleRetryConnect(item, event)
                          }
                        }}
                      />
                      <AppButton
                        variant="icon"
                        icon={<EditOutlined />}
                        onClick={(event) => {
                          event.stopPropagation()
                          setEditing(item)
                          setFormOpen(true)
                        }}
                      />
                      <Popconfirm
                        title="Delete this connection?"
                        onConfirm={() => void handleDelete(item.id)}
                      >
                        <span onClick={(event) => event.stopPropagation()}>
                          <AppButton variant="danger" icon={<DeleteOutlined />} />
                        </span>
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Spin>

      <ConnectionForm
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => void loadConnections()}
      />
    </div>
  )
}
