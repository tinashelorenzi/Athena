'use client';
import React from 'react';
import { Select as AntSelect, Flex, theme } from 'antd';

const SIZES = { sm: 'small', md: 'medium', lg: 'large' };

/* Select over antd Select, keeping the native-<select> contract callers rely on:
   - options: strings or { value, label }
   - onChange receives an event-like `{ target: { value, name } }`
   - `name` is mirrored into a hidden input so it submits with plain forms
   - works controlled (`value`) or uncontrolled (`defaultValue`). */
export function Select(props) {
  const {
    label,
    size = 'md',
    options = [],
    id,
    name,
    value,
    defaultValue,
    onChange,
    disabled,
    className = '',
    style,
  } = props;
  // Everything else passes through to antd; native-only props are dropped.
  const rest = { ...props };
  ['label', 'size', 'options', 'children', 'id', 'name', 'value', 'defaultValue', 'onChange', 'disabled', 'required', 'className', 'style'].forEach((k) => delete rest[k]);
  const { token } = theme.useToken();
  const opts = options.map((o) => (typeof o === 'object' ? { value: o.value, label: o.label } : { value: o, label: o }));
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(defaultValue !== undefined ? defaultValue : opts[0]?.value);
  const current = controlled ? value : inner;
  const fieldId = id || (label ? `s-${String(label).replace(/\s+/g, '-').toLowerCase()}` : undefined);

  const handle = (v) => {
    if (!controlled) setInner(v);
    if (onChange) onChange({ target: { value: v, name }, currentTarget: { value: v, name } });
  };

  const control = (
    <>
      <AntSelect
        id={fieldId}
        size={SIZES[size] || 'medium'}
        value={current}
        onChange={handle}
        options={opts}
        disabled={disabled}
        className={className}
        style={{ width: '100%', ...style }}
        {...rest}
      />
      {name && <input type="hidden" name={name} value={current ?? ''} />}
    </>
  );
  if (!label) return control;
  return (
    <Flex vertical gap={6}>
      <label htmlFor={fieldId} style={{ fontSize: 13, fontWeight: 500, color: token.colorTextSecondary }}>{label}</label>
      {control}
    </Flex>
  );
}
