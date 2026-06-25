import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['electron-store', 'mysql2', 'pg']
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id): string | undefined {
            if (id.includes('monaco-editor')) return 'monaco'
            if (id.includes('node_modules/antd')) return 'antd'
            return undefined
          }
        }
      }
    }
  }
})
