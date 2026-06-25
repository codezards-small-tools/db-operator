import { useEffect, useState } from 'react'
import { Layout } from 'antd'

const { Sider } = Layout

const STORAGE_KEY = 'db-operator:sider-width'
const DEFAULT_WIDTH = 320
const MIN_WIDTH = 240
const MAX_WIDTH = 560

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
}

function readStoredWidth(): number {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return DEFAULT_WIDTH

  const parsed = Number(saved)
  if (Number.isNaN(parsed)) return DEFAULT_WIDTH

  return clampWidth(parsed)
}

interface ResizableSiderProps {
  children: React.ReactNode
}

export default function ResizableSider({ children }: ResizableSiderProps): React.JSX.Element {
  const [width, setWidth] = useState(readStoredWidth)
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width))
  }, [width])

  const handleMouseDown = (event: React.MouseEvent): void => {
    event.preventDefault()

    const startX = event.clientX
    const startWidth = width
    setResizing(true)

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      setWidth(clampWidth(startWidth + moveEvent.clientX - startX))
    }

    const handleMouseUp = (): void => {
      setResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      className={`resizable-sider ${resizing ? 'resizable-sider--resizing' : ''}`}
      style={{ width, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}
    >
      <Sider width={width} className="left-sider" theme="light">
        {children}
      </Sider>
      <div
        className="sider-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}
