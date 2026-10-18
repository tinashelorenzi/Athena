'use client';
import React from 'react';
import { Flex, Typography } from 'antd';

/* Page heading: title (Typography h4) + secondary description, with optional
   right-aligned extra actions. */
export function PageHeader({ title, description, extra, style, ...rest }) {
  return (
    <Flex justify="space-between" align="flex-end" gap={16} wrap style={style} {...rest}>
      <div style={{ minWidth: 0 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
        {description && <Typography.Text type="secondary">{description}</Typography.Text>}
      </div>
      {extra && <Flex gap={8} align="center" wrap>{extra}</Flex>}
    </Flex>
  );
}
