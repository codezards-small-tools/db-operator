import { ConfigProvider, theme } from 'antd'
import App from './App'
import { useThemeStore } from './stores/theme'

export function ThemedApp(): React.JSX.Element {
  const themeMode = useThemeStore((state) => state.theme)

  return (
    <ConfigProvider
      theme={{
        algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: themeMode === 'dark' ? '#3b82f6' : '#2563eb',
          borderRadius: 8,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
        },
        components: {
          Button: {
            controlHeight: 32,
            controlHeightSM: 28,
            fontWeight: 500,
            paddingInline: 12,
            paddingInlineSM: 10,
            primaryShadow: 'none',
            defaultShadow: 'none'
          }
        }
      }}
    >
      <App />
    </ConfigProvider>
  )
}
