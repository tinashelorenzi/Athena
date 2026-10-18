'use client';
import React from 'react';
import { Switch as AntSwitch, Space } from 'antd';

/* antd Switch. onChange receives an event-like `{ target: { checked, name } }`
   (callers previously got the native checkbox event). A `name` is mirrored to
   a hidden input so the value still posts with a plain form. */
export function Switch({ label, checked, disabled = false, onChange, name, size, className = '', ...rest }) {
  const sw = (
    <AntSwitch
      checked={checked}
      disabled={disabled}
      size={size === 'sm' ? 'small' : undefined}
      onChange={(c) => onChange && onChange({ target: { checked: c, name }, currentTarget: { checked: c, name } })}
      className={label == null ? className : undefined}
      {...rest}
    />
  );
  const hidden = name ? <input type="hidden" name={name} value={checked ? 'on' : ''} /> : null;
  if (label == null) return <>{sw}{hidden}</>;
  return (
    <label className={className} style={{ display: 'inline-flex', cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <Space size={9}>{sw}<span>{label}</span></Space>
      {hidden}
    </label>
  );
}
