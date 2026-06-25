import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'db-operator:sql-panel-ratio'
const DEFAULT_RATIO = 0.42
const MIN_RATIO = 0.15
const MAX_RATIO = 0.75
const MIN_EDITOR_PX = 220
const MIN_RESULT_PX = 160
const HANDLE_HEIGHT = 6

function clampRatio(ratio: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))
}

function readStoredRatio(): number {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return DEFAULT_RATIO

  const parsed = Number(saved)
  return Number.isNaN(parsed) ? DEFAULT_RATIO : clampRatio(parsed)
}

interface ResizableMainContentProps {
  editor: React.ReactNode
  results: React.ReactNode
}

export default function ResizableMainContent({
  editor,
  results
}: ResizableMainContentProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(readStoredRatio)
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(ratio))
  }, [ratio])

  const clampRatioToContainer = useCallback((nextRatio: number): number => {
    const container = containerRef.current
    if (!container) return clampRatio(nextRatio)

    const containerHeight = container.clientHeight
    if (containerHeight <= 0) return clampRatio(nextRatio)

    const minRatio = MIN_EDITOR_PX / containerHeight
    const maxRatio = (containerHeight - MIN_RESULT_PX - HANDLE_HEIGHT) / containerHeight

    return Math.min(maxRatio, Math.max(minRatio, nextRatio))
  }, [])

  const handleMouseDown = (event: React.MouseEvent): void => {
    event.preventDefault()

    const container = containerRef.current
    if (!container) return

    const startY = event.clientY
    const startRatio = ratio
    const containerHeight = container.clientHeight
    setResizing(true)

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const deltaRatio = (moveEvent.clientY - startY) / containerHeight
      setRatio(clampRatioToContainer(startRatio + deltaRatio))
    }

    const handleMouseUp = (): void => {
      setResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      ref={containerRef}
      className={`main-content resizable-main-content ${resizing ? 'resizable-main-content--resizing' : ''}`}
    >
      <div className="resizable-main-content__editor" style={{ height: `${ratio * 100}%` }}>
        {editor}
      </div>
      <div
        className="panel-resize-handle panel-resize-handle--horizontal"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize SQL editor and results"
        aria-valuenow={Math.round(ratio * 100)}
        onMouseDown={handleMouseDown}
      />
      <div className="resizable-main-content__results">{results}</div>
    </div>
  )
}
