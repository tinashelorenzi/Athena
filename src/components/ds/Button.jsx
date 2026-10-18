'use client';
import React from 'react';
import { Button as AntButton, ConfigProvider } from 'antd';

/* Brand-yellow ("accent") buttons: a scoped primary colour so antd still
   generates proper hover / active states. */
const ACCENT_THEME = {
  token: { colorPrimary: '#F9C80E' },
  components: { Button: { primaryColor: '#1A1400' } },
};

const SIZES = { sm: 'small', md: 'medium', lg: 'large' };

/* variant → antd colour/variant pair */
const VARIANTS = {
  primary: { type: 'primary' },
  accent: { type: 'primary' },
  secondary: { type: 'default' },
  ghost: { type: 'text' },
  danger: { type: 'primary', danger: true },
  'outline-danger': { type: 'default', danger: true },
};

/* Thin wrapper over antd Button keeping the original DS API:
   variant (primary|accent|secondary|ghost|danger|outline-danger),
   size (sm|md|lg), block, loading, leadingIcon, trailingIcon.
   `type` maps to the native button type (antd `htmlType`); like a native
   <button> it defaults to "submit". */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  leadingIcon = null,
  trailingIcon = null,
  type = 'submit',
  children,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const icon = leadingIcon || (!children && trailingIcon) || undefined;
  const btn = (
    <AntButton
      {...v}
      htmlType={type}
      size={SIZES[size] || 'medium'}
      block={block}
      loading={loading}
      disabled={disabled}
      icon={icon}
      {...rest}
    >
      {children}
      {children != null && trailingIcon ? <span style={{ display: 'inline-flex' }}>{trailingIcon}</span> : null}
    </AntButton>
  );
  return variant === 'accent' ? <ConfigProvider theme={ACCENT_THEME}>{btn}</ConfigProvider> : btn;
}
