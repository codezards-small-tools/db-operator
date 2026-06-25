import { useEffect, useRef, useState } from 'react'
import { Dropdown, Input, type InputRef, type MenuProps } from 'antd'

interface SqlEditorTabLabelProps {
  title: string
  fallbackTitle: string
  closable: boolean
  onRename: (title: string) => void
  onClose: () => void
  onInsertLeft: () => void
  onInsertRight: () => void
}

export default function SqlEditorTabLabel({
  title,
  fallbackTitle,
  closable,
  onRename,
  onClose,
  onInsertLeft,
  onInsertRight
}: SqlEditorTabLabelProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<InputRef>(null)

  useEffect(() => {
    if (!editing) {
      setDraft(title)
    }
  }, [title, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = (): void => {
    const trimmed = draft.trim()
    if (trimmed) {
      onRename(trimmed)
    }
    setEditing(false)
  }

  const startRename = (): void => {
    setDraft(title || fallbackTitle)
    setEditing(true)
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'rename',
      label: 'Rename',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation()
        startRename()
      }
    },
    {
      key: 'close',
      label: 'Close tab',
      disabled: !closable,
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation()
        onClose()
      }
    },
    { type: 'divider' },
    {
      key: 'insert-left',
      label: 'New tab to the left',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation()
        onInsertLeft()
      }
    },
    {
      key: 'insert-right',
      label: 'New tab to the right',
      onClick: ({ domEvent }) => {
        domEvent.stopPropagation()
        onInsertRight()
      }
    }
  ]

  if (editing) {
    return (
      <Input
        ref={inputRef}
        size="small"
        className="sql-editor-tab-label__input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setDraft(title)
            setEditing(false)
          }
        }}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.stopPropagation()}
      />
    )
  }

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
      <span
        className="sql-editor-tab-label"
        onDoubleClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          startRename()
        }}
      >
        {title || fallbackTitle}
      </span>
    </Dropdown>
  )
}
