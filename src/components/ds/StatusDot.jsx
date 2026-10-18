'use client';
import React from 'react';
import { Badge } from 'antd';

const LABELS = { online: 'Online', offline: 'Offline', isolated: 'Isolated', warning: 'Degraded', danger: 'Compromised' };
const STATUS = { online: 'success', offline: 'default', isolated: 'processing', warning: 'warning', danger: 'error' };

/* Host / agent status indicator over antd Badge `status`. */
export function StatusDot({ status = 'offline', label, ...rest }) {
  return (
    <Badge
      status={STATUS[status] || 'default'}
      text={label === false ? undefined : (label ?? LABELS[status])}
      {...rest}
    />
  );
}
