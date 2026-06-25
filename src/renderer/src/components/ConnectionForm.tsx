import { useEffect, useState } from 'react'
import { Form, Input, InputNumber, Modal, Select, Switch, message } from 'antd'
import type { ConnectionConfig, DbType } from '../../../shared/types'
import { DEFAULT_PORTS } from '../../../shared/types'
import type { PublicConnection } from '../../../preload/index'
import AppButton from './AppButton'

interface ConnectionFormProps {
  open: boolean
  initial?: PublicConnection | null
  onClose: () => void
  onSaved: () => void
}

export default function ConnectionForm({
  open,
  initial,
  onClose,
  onSaved
}: ConnectionFormProps): React.JSX.Element {
  const [form] = Form.useForm<ConnectionConfig>()
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return

    if (initial) {
      form.setFieldsValue({
        ...initial,
        password: ''
      })
    } else {
      form.setFieldsValue({
        id: '',
        name: '',
        type: 'mysql',
        host: '127.0.0.1',
        port: DEFAULT_PORTS.mysql,
        username: 'root',
        password: '',
        database: '',
        ssl: false
      })
    }
  }, [form, initial, open])

  const handleTypeChange = (type: DbType): void => {
    form.setFieldValue('port', DEFAULT_PORTS[type])
  }

  const buildPayload = (): ConnectionConfig => {
    const values = form.getFieldsValue(true) as ConnectionConfig
    return {
      ...values,
      id: initial?.id || values.id || '',
      database: values.database?.trim() || undefined
    }
  }

  const handleTest = async (): Promise<void> => {
    try {
      await form.validateFields()
      setTesting(true)
      const result = await window.dbApi.connection.test(buildPayload())
      if (result.success) {
        message.success('Connection successful')
      } else {
        message.error(result.error || 'Connection failed')
      }
    } catch {
      // validation errors handled by form
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    try {
      await form.validateFields()
      setSaving(true)
      await window.dbApi.connection.save(buildPayload())
      message.success('Connection saved')
      onSaved()
      onClose()
    } catch {
      // validation errors handled by form
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={initial ? 'Edit Connection' : 'New Connection'}
      open={open}
      onCancel={onClose}
      width={520}
      footer={[
        <AppButton key="test" variant="secondary" size="middle" loading={testing} onClick={() => void handleTest()}>
          Test
        </AppButton>,
        <AppButton key="cancel" variant="secondary" size="middle" onClick={onClose}>
          Cancel
        </AppButton>,
        <AppButton key="save" variant="primary" size="middle" loading={saving} onClick={() => void handleSave()}>
          Save
        </AppButton>
      ]}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="id" hidden>
          <Input />
        </Form.Item>
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: 'Please enter a connection name' }]}
        >
          <Input placeholder="Local MySQL" />
        </Form.Item>
        <Form.Item label="Type" name="type" rules={[{ required: true }]}>
          <Select
            options={[
              { value: 'mysql', label: 'MySQL' },
              { value: 'postgresql', label: 'PostgreSQL' }
            ]}
            onChange={handleTypeChange}
          />
        </Form.Item>
        <Form.Item label="Host" name="host" rules={[{ required: true }]}>
          <Input placeholder="127.0.0.1" />
        </Form.Item>
        <Form.Item label="Port" name="port" rules={[{ required: true }]}>
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Username" name="username" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="Password"
          name="password"
          extra={initial?.hasPassword ? 'Leave blank to keep the saved password' : undefined}
        >
          <Input.Password />
        </Form.Item>
        <Form.Item label="Default Database" name="database">
          <Input placeholder="Optional" />
        </Form.Item>
        <Form.Item label="SSL" name="ssl" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}
