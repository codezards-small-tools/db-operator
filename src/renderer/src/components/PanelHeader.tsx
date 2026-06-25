import type { ReactNode } from 'react'

interface PanelHeaderProps {
  title: string
  extra?: ReactNode
}

export default function PanelHeader({ title, extra }: PanelHeaderProps): React.JSX.Element {
  return (
    <div className="panel-header">
      <span className="panel-header__title">{title}</span>
      {extra ? <div className="panel-header__extra">{extra}</div> : null}
    </div>
  )
}
