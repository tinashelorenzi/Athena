'use client';
import React from 'react';
import { Empty, Flex, Typography, theme } from 'antd';

/* Empty placeholder over antd Empty. Props: icon (falls back to the simple
   antd illustration), title, description, actions. */
export function EmptyState({ icon, title, description, actions, style, ...rest }) {
  const { token } = theme.useToken();
  const image = icon ? (
    <Flex
      align="center"
      justify="center"
      style={{
        width: 52, height: 52, margin: '0 auto', borderRadius: token.borderRadiusLG,
        background: token.colorFillTertiary, color: token.colorTextTertiary,
      }}
    >
      {icon}
    </Flex>
  ) : Empty.PRESENTED_IMAGE_SIMPLE;
  return (
    <Empty
      image={image}
      styles={{ image: { height: 'auto', marginBottom: 12 } }}
      style={{ padding: '32px 16px', ...style }}
      description={
        (title || description) ? (
          <Flex vertical gap={4} align="center">
            {title && <Typography.Text strong style={{ fontSize: 15 }}>{title}</Typography.Text>}
            {description && <Typography.Text type="secondary" style={{ maxWidth: 380 }}>{description}</Typography.Text>}
          </Flex>
        ) : null
      }
      {...rest}
    >
      {actions && <Flex gap={8} justify="center">{actions}</Flex>}
    </Empty>
  );
}
