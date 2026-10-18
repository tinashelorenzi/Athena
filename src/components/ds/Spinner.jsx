'use client';
import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const SIZES = { sm: 14, md: 20, lg: 32 };

/* Inline loading indicator over antd Spin. size: sm|md|lg|<px>. */
export function Spinner({ size = 'md', style, ...rest }) {
  const px = typeof size === 'number' ? size : SIZES[size] || 20;
  return (
    <Spin
      indicator={<LoadingOutlined style={{ fontSize: px }} spin />}
      style={{ lineHeight: 0, ...style }}
      aria-label="Loading"
      {...rest}
    />
  );
}
