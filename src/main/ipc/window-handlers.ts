import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'

function getSenderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  const window = BrowserWindow.fromWebContents(event.sender)
  return window && !window.isDestroyed() ? window : null
}

export function registerWindowHandlers(): void {
  ipcMain.handle('window:getPlatform', () => process.platform)

  ipcMain.handle('window:minimize', (event) => {
    getSenderWindow(event)?.minimize()
  })

  ipcMain.handle('window:toggleMaximize', (event) => {
    const window = getSenderWindow(event)
    if (!window) return

    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })

  ipcMain.handle('window:close', (event) => {
    getSenderWindow(event)?.close()
  })

  ipcMain.handle('window:isMaximized', (event) => {
    return getSenderWindow(event)?.isMaximized() ?? false
  })
}

export function attachWindowStateEvents(window: BrowserWindow): void {
  const notify = (): void => {
    if (window.isDestroyed()) return
    window.webContents.send('window:maximized-changed', window.isMaximized())
  }

  window.on('maximize', notify)
  window.on('unmaximize', notify)
}
