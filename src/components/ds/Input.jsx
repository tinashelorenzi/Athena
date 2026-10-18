'use client';
import React from 'react';
import { Input as AntInput, Flex, Typography, theme } from 'antd';

const SIZES = { sm: 'small', md: 'medium', lg: 'large' };

/* Labelled text input over antd Input. Keeps the DS API (label, hint, error,
   size, mono, leadingIcon, trailingIcon) and passes every other prop
   (name, value, defaultValue, onChange(event), required, type, …) straight to
   the native <input>, so it still works inside plain <form action>. */
export function Input({
  label,
  hint,
  error,
  size = 'md',
  mono = false,
  disabled = false,
  leadingIcon = null,
  trailingIcon = null,
  id,
  className = '',
  style,
  ...rest
}) {
  const { token } = theme.useToken();
  const fieldId = id || (label ? `f-${String(label).replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const control = (
    <AntInput
      id={fieldId}
      size={SIZES[size] || 'medium'}
      disabled={disabled}
      status={error ? 'error' : undefined}
      prefix={leadingIcon ? <span style={{ display: 'inline-flex', color: token.colorTextTertiary }}>{leadingIcon}</span> : undefined}
      suffix={trailingIcon ? <span style={{ display: 'inline-flex', color: token.colorTextTertiary }}>{trailingIcon}</span> : undefined}
      className={className}
      style={style}
      styles={mono ? { input: { fontFamily: token.fontFamilyCode } } : undefined}
      {...rest}
    />
  );
  if (!label && !hint && !error) return control;
  return (
    <Flex vertical gap={6}>
      {label && (
        <label htmlFor={fieldId} style={{ fontSize: 13, fontWeight: 500, color: token.colorTextSecondary }}>
          {label}
        </label>
      )}
      {control}
      {(error || hint) && (
        <Typography.Text type={error ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
          {error || hint}
        </Typography.Text>
      )}
    </Flex>
  );
}
