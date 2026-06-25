import './setup/monaco'
import './styles/tokens.css'
import './styles/global.css'
import './styles/ant-overrides.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemedApp } from './ThemedApp'
import { useThemeStore } from './stores/theme'

async function bootstrap(): Promise<void> {
  if (import.meta.env.DEV && typeof window.dbApi === 'undefined') {
    const { installMockDbApi } = await import('./dev/mock-db-api')
    installMockDbApi()
  }

  useThemeStore.getState().applyTheme()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemedApp />
    </StrictMode>
  )
}

void bootstrap()
