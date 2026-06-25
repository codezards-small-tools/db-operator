import { useRef } from 'react'
import { useTableScrollChrome } from '../hooks/useTableScrollChrome'

interface TableScrollShellProps {
  children: React.ReactNode
  className?: string
  refreshKey?: unknown
}

export default function TableScrollShell({
  children,
  className,
  refreshKey
}: TableScrollShellProps): React.JSX.Element {
  const shellRef = useRef<HTMLDivElement>(null)
  useTableScrollChrome(shellRef, refreshKey)

  const shellClassName = ['table-scroll-shell', className].filter(Boolean).join(' ')

  return (
    <div ref={shellRef} className={shellClassName}>
      {children}
      <div className="table-scroll-shell__fades" aria-hidden>
        <div className="table-scroll-shell__fade table-scroll-shell__fade--top" />
        <div className="table-scroll-shell__fade table-scroll-shell__fade--bottom" />
        <div className="table-scroll-shell__fade table-scroll-shell__fade--left" />
        <div className="table-scroll-shell__fade table-scroll-shell__fade--right" />
      </div>
    </div>
  )
}
