'use client';
import React from 'react';
import { Form, Input, theme } from 'antd';

/* Small shared authoring primitives, extracted so both ScenarioFields and
   JsonField can use them without a circular import. */

/* Labelled field (antd Form.Item layout only — the child keeps its own `name`
   and posts natively with the surrounding <form>). */
export function Field({ label, hint, required, children }) {
  return (
    <Form.Item label={label} extra={hint} required={required}>
      {children}
    </Form.Item>
  );
}

/* antd TextArea; `mono` switches to the code font (JSON / markdown). */
export function Textarea({ mono, rows = 4, style, ...rest }) {
  const { token } = theme.useToken();
  return (
    <Input.TextArea
      rows={rows}
      spellCheck={false}
      style={{ ...(mono ? { fontFamily: token.fontFamilyCode, fontSize: 12.5 } : null), ...style }}
      {...rest}
    />
  );
}
