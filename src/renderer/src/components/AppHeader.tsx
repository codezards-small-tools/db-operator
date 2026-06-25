import { Layout } from 'antd'
import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import AppButton from './AppButton'
import WindowControls from './WindowControls'
import { useAppStore } from '../stores/connection'
import { useThemeStore } from '../stores/theme'
import appIcon from '../assets/app-icon.svg'

interface AppHeaderProps {
  frameless?: boolean
}

export default function AppHeader({ frameless = false }: AppHeaderProps): React.JSX.Element {
  const { connections, activeConnectionId, activeSessionId, connectionStatus, connectAttempt } =
    useAppStore()
  const { theme, toggleTheme } = useThemeStore()

  const activeConnection = connections.find((item) => item.id === activeConnectionId)

  const statusClassName = ((): string => {
    if (connectionStatus === 'connected' && activeSessionId) return 'status-pill--connected'
    if (connectionStatus === 'connecting' || connectionStatus === 'retrying') {
      return 'status-pill--retrying'
    }
    if (connectionStatus === 'failed') return 'status-pill--failed'
    if (activeConnectionId) return 'status-pill--offline'
    return 'status-pill--disconnected'
  })()

  const statusText = ((): string => {
    if (!activeConnection) return 'Not connected'
    const name = activeConnection.name

    if (connectionStatus === 'connected' && activeSessionId) {
      return `Connected: ${name}`
    }
    if (connectionStatus === 'connecting') {
      return `Connecting: ${name}...`
    }
    if (connectionStatus === 'retrying') {
      return `Reconnecting: ${name} (${connectAttempt})...`
    }
    if (connectionStatus === 'failed') {
      return `Connection failed: ${name}`
    }
    return `Selected: ${name} (offline)`
  })()

  const handleDragDoubleClick = (): void => {
    if (!frameless) return
    void window.windowApi?.toggleMaximize()
  }

  return (
    <Layout.Header
      className={frameless ? 'app-header app-header--frameless' : 'app-header'}
    >
      <div
        className="app-header__drag"
        onDoubleClick={handleDragDoubleClick}
      >
        <div className="app-header__brand">
          <img src={appIcon} alt="" className="app-header__icon" width={20} height={20} />
          <span className="app-header__logo">DB Operator</span>
          <span className="app-header__subtitle">Database Client</span>
        </div>

        <div className="app-header__status">
          <div className={`status-pill ${statusClassName}`}>
            <span className="status-pill__dot" />
            {statusText}
          </div>
        </div>
      </div>

      <div className="app-header__actions">
        <AppButton
          variant="icon"
          className="app-header__theme-btn"
          icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          onClick={toggleTheme}
          aria-label="Toggle theme"
        />
        <WindowControls />
      </div>
    </Layout.Header>
  )
}
