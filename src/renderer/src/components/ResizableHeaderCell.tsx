interface ResizableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  width?: number
  minWidth?: number
  onResize?: (width: number) => void
}

export default function ResizableHeaderCell({
  width,
  minWidth = 48,
  onResize,
  children,
  style,
  ...rest
}: ResizableHeaderCellProps): React.JSX.Element {
  if (!width || !onResize) {
    return (
      <th {...rest} style={style}>
        {children}
      </th>
    )
  }

  const handleMouseDown = (event: React.MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = width

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const nextWidth = Math.max(minWidth, startWidth + moveEvent.clientX - startX)
      onResize(nextWidth)
    }

    const handleMouseUp = (): void => {
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
    <th {...rest} style={{ ...style, position: 'relative', width }}>
      {children}
      <span
        className="app-table__resize-handle"
        onMouseDown={handleMouseDown}
        onClick={(event) => event.stopPropagation()}
      />
    </th>
  )
}
