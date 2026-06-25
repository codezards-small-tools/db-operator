import { useEffect, useState } from 'react'
import { isWebPreviewMode } from '../dev/web-preview'

function MinimizeIcon(): React.JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
      <rect x="1" y="5" width="9" height="1" fill="currentColor" />
    </svg>
  )
}

function MaximizeIcon(): React.JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="8"
        height="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  )
}

function RestoreIcon(): React.JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
      <path
        d="M1.5 1.5h6M1.5 1.5v6h2M7.5 1.5v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <rect
        x="3.5"
        y="3.5"
        width="6"
        height="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  )
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
      <path
        d="M2.5 2.5l6 6M8.5 2.5l-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="square"
      />
    </svg>
  )
}

export default function WindowControls(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (isWebPreviewMode() || !window.windowApi) {
      setVisible(false)
      return
    }

    let cancelled = false
    let removeListener: (() => void) | undefined

    void window.windowApi.getPlatform().then((platform) => {
      if (cancelled || platform !== 'win32') return

      setVisible(true)
      void window.windowApi?.isMaximized().then((value) => {
        if (!cancelled) setMaximized(value)
      })
      removeListener = window.windowApi?.onMaximizedChanged((value) => {
        setMaximized(value)
      })
    })

    return () => {
      cancelled = true
      removeListener?.()
    }
  }, [])

  if (!visible) return null

  return (
    <div className="window-controls">
      <button
        type="button"
        className="window-controls__btn"
        aria-label="Minimize"
        onClick={() => void window.windowApi?.minimize()}
      >
        <MinimizeIcon />
      </button>
      <button
        type="button"
        className="window-controls__btn"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={() => void window.windowApi?.toggleMaximize()}
      >
        {maximized ? <RestoreIcon /> : <MaximizeIcon />}
      </button>
      <button
        type="button"
        className="window-controls__btn window-controls__btn--close"
        aria-label="Close"
        onClick={() => void window.windowApi?.close()}
      >
        <CloseIcon />
      </button>
    </div>
  )
}
