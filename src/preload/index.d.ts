import { ElectronAPI } from '@electron-toolkit/preload'
import type { DbApi, PublicConnection, WindowApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    dbApi: DbApi
    windowApi?: WindowApi
  }
}

export type { DbApi, PublicConnection, WindowApi }
