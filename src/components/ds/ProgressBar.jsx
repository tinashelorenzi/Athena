'use client';
import React from 'react';
import { Progress, Flex, Typography, theme } from 'antd';

/* Linear progress over antd Progress. Props: value, max, label, showValue,
   tone (brand|accent|success|critical), size (md|lg). */
export function ProgressBar({ value = 0, max = 100, label, showValue = false, tone = 'brand', size = 'md', style, ...rest }) {
  const { token } = theme.useToken();
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const color = { brand: token.colorPrimary, accent: '#F9C80E', success: token.colorSuccess, critical: token.colorError }[tone] || token.colorPrimary;
  return (
    <div style={{ width: '100%', ...style }} {...rest}>
      {(label || showValue) && (
        <Flex justify="space-between" style={{ marginBottom: 4 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{label}</Typography.Text>
          {showValue && <Typography.Text strong style={{ fontSize: 12 }}>{Math.round(pct)}%</Typography.Text>}
        </Flex>
      )}
      <Progress
        percent={pct}
        showInfo={false}
        strokeColor={color}
        size={{ height: size === 'lg' ? 10 : 6 }}
        style={{ margin: 0 }}
        aria-valuenow={value}
        aria-valuemax={max}
      />
    </div>
  );
}
