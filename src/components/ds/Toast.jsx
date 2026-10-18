'use client';
import React from 'react';
import { Alert } from 'antd';

const TYPES = { success: 'success', danger: 'error', error: 'error', warning: 'warning', info: 'info' };

/* Inline notice over antd Alert. tone (success|danger|warning|info), title,
   message, onClose (makes it dismissable). For transient toasts prefer
   App.useApp().message / notification. */
export function Toast({ tone = 'info', title, message, onClose, ...rest }) {
  return (
    <Alert
      type={TYPES[tone] || 'info'}
      showIcon
      title={title || message}
      description={title ? message : undefined}
      closable={onClose ? { onClose } : false}
      role="status"
      {...rest}
    />
  );
}
