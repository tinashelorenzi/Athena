'use client';
import React, { useState } from 'react';
import { Button, Card, Flex, Form, Typography, theme } from 'antd';
import { BulbOutlined, EnterOutlined } from '@ant-design/icons';
import { Textarea } from './primitives';
import { FileField } from '../settings/parts';
import { EXAMPLES } from './scenario-examples';

/* A JSON data section for the scenario builder: label + file upload + a
   collapsible, copyable example + a monospace textarea. `name` is the base key;
   the textarea posts as `${name}Json` and the file as `${name}File` (matching
   the server actions). `example` selects an entry from EXAMPLES. */
export function JsonField({ label, name, placeholder, hint, example, defaultValue = '', rows = 5 }) {
  const { token } = theme.useToken();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const ex = example ? EXAMPLES[example] : null;

  return (
    <Form.Item label={label} extra={hint}>
      <Flex vertical gap={8}>
        <Flex align="flex-start" gap={8} wrap>
          <FileField name={`${name}File`} accept="application/json,.json" label="Upload .json" size="small" />
          {ex && (
            <Button type="link" size="small" icon={<BulbOutlined />} onClick={() => setOpen((o) => !o)}>
              {open ? 'Hide example' : 'Show example'}
            </Button>
          )}
        </Flex>

        {open && ex && (
          <Card
            size="small"
            title={<Typography.Text type="secondary" style={{ fontSize: 12 }}>Example</Typography.Text>}
            extra={
              <Flex gap={8} align="center">
                <Typography.Text copyable={{ text: ex, tooltips: ['Copy', 'Copied'] }} />
                <Button size="small" icon={<EnterOutlined />} onClick={() => setValue(ex)}>Use this</Button>
              </Flex>
            }
            styles={{ body: { padding: 0 } }}
          >
            <pre style={{ margin: 0, padding: '10px 12px', maxHeight: 240, overflow: 'auto', fontFamily: token.fontFamilyCode, fontSize: 12, color: token.colorTextSecondary, background: token.colorFillQuaternary }}>{ex}</pre>
          </Card>
        )}

        <Textarea name={`${name}Json`} mono rows={rows} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      </Flex>
    </Form.Item>
  );
}

export default JsonField;
