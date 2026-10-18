'use client';
import React from 'react';
import { Button as AntButton } from 'antd';

const SIZES = { sm: 'small', md: 'medium', lg: 'large' };

/* Square icon-only button. variant: ghost (text) | solid (bordered);
   `active` highlights it as a toggled-on control. `label` becomes the
   accessible name and native tooltip. Native type defaults to "submit". */
export function IconButton({
  size = 'md',
  variant = 'ghost',
  active = false,
  disabled = false,
  label,
  type = 'submit',
  children,
  ...rest
}) {
  const look = active
    ? { color: 'primary', variant: 'filled' }
    : variant === 'solid'
      ? { color: 'default', variant: 'outlined' }
      : { color: 'default', variant: 'text' };
  return (
    <AntButton
      {...look}
      htmlType={type}
      size={SIZES[size] || 'medium'}
      disabled={disabled}
      aria-label={label}
      title={label}
      icon={children}
      {...rest}
    />
  );
}
