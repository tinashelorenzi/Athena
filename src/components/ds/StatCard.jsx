'use client';
import React from 'react';
import { Card, Statistic, Flex, Typography, theme } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';

const ARROWS = { up: <ArrowUpOutlined />, down: <ArrowDownOutlined />, flat: <MinusOutlined /> };

/* KPI tile over antd Card + Statistic. Props: label, value, icon, delta,
   deltaDir (up = worse/red, down = better/green, flat), hint,
   tone (default | accent | warning | critical | danger | success). */
export function StatCard({ label, value, icon, delta, deltaDir = 'flat', hint, tone = 'default', style, ...rest }) {
  const { token } = theme.useToken();
  const toneColor = {
    accent: token.colorWarningText,
    warning: token.colorWarning,
    critical: token.colorError,
    danger: token.colorError,
    success: token.colorSuccess,
  }[tone];
  const deltaColor = deltaDir === 'up' ? token.colorError : deltaDir === 'down' ? token.colorSuccess : token.colorTextTertiary;
  const critical = tone === 'critical' || tone === 'danger';
  return (
    <Card
      size="small"
      style={{ ...(critical ? { borderColor: token.colorErrorBorder } : null), ...style }}
      styles={{ body: { padding: '16px 18px' } }}
      {...rest}
    >
      <Statistic
        title={
          <Flex justify="space-between" align="center" gap={8}>
            <span>{label}</span>
            {icon && <span style={{ display: 'inline-flex', color: token.colorTextTertiary }}>{icon}</span>}
          </Flex>
        }
        value={value}
        styles={{ content: { fontWeight: 600, fontSize: 26, color: toneColor } }}
      />
      {(delta != null || hint) && (
        <Flex gap={6} align="center" style={{ marginTop: 6, fontSize: 12 }}>
          {delta != null && (
            <span style={{ color: deltaColor, fontWeight: 600, display: 'inline-flex', gap: 3, alignItems: 'center' }}>
              {ARROWS[deltaDir]}{delta}
            </span>
          )}
          {hint && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{hint}</Typography.Text>}
        </Flex>
      )}
    </Card>
  );
}
