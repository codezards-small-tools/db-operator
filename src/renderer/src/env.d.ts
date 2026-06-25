/// <reference types="vite/client" />

import type { ElectronAPI } from '@electron-toolkit/preload'
import type { DbApi } from '../../preload/index'
import type { WindowApi } from '../../preload/index'

declare module '*?worker' {
  const workerConstructor: new () => Worker
  export default workerConstructor
}

declare global {
  interface Window {
    dbApi: DbApi
    electron?: ElectronAPI
    windowApi?: WindowApi
  }
}

export {}
