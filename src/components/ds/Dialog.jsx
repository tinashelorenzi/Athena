'use client';
import React from 'react';
import { Modal, Flex, Typography, theme } from 'antd';

const WIDTHS = { sm: 420, md: 560, lg: 760 };

/* Modal dialog over antd Modal. Props: open, title, description, icon,
   size (sm|md|lg), onClose (omit → not dismissable), footer (node; no
   default OK/Cancel buttons), children. */
export function Dialog({ open = true, title, description, icon, size = 'md', onClose, footer, children, className, style }) {
  const { token } = theme.useToken();
  const header = (title || description) ? (
    <Flex gap={12} align="flex-start">
      {icon && <span style={{ display: 'inline-flex', marginTop: 3, color: token.colorPrimary }}>{icon}</span>}
      <div style={{ minWidth: 0 }}>
        {title && <div>{title}</div>}
        {description && (
          <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 400 }}>
            {description}
          </Typography.Paragraph>
        )}
      </div>
    </Flex>
  ) : null;
  return (
    <Modal
      open={open}
      title={header}
      width={WIDTHS[size] || WIDTHS.md}
      onCancel={onClose}
      closable={!!onClose}
      keyboard={!!onClose}
      mask={{ closable: !!onClose }}
      footer={footer || null}
      destroyOnHidden
      centered
      className={className}
      style={style}
      styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', paddingTop: 8 } }}
    >
      {children}
    </Modal>
  );
}
