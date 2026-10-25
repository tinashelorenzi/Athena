'use client';
import React from 'react';
import Link from 'next/link';
import { Flex, Tag, Tooltip } from 'antd';
import { AimOutlined } from '@ant-design/icons';
import { attackDomainOf } from '@/lib/scenario-schemas';

/* A scenario's ATT&CK technique IDs as tags, each opening the technique in the
   ATT&CK Explorer. `max` collapses the rest into a "+N" tag. */
export function TechniqueTags({ ids = [], max, style }) {
  if (!ids.length) return null;
  const shown = max ? ids.slice(0, max) : ids;
  const rest = ids.length - shown.length;
  return (
    <Flex wrap gap={4} style={style}>
      {shown.map((id) => (
        <Tooltip key={id} title="Open in the ATT&CK Explorer">
          <Link href={`/attack?domain=${attackDomainOf(id)}&t=${encodeURIComponent(id)}`}>
            <Tag color="geekblue" icon={<AimOutlined />} style={{ margin: 0, fontFamily: 'var(--ath-font-family-code)', cursor: 'pointer' }}>
              {id}
            </Tag>
          </Link>
        </Tooltip>
      ))}
      {rest > 0 && (
        <Tooltip title={ids.slice(shown.length).join(', ')}>
          <Tag style={{ margin: 0 }}>+{rest}</Tag>
        </Tooltip>
      )}
    </Flex>
  );
}

export default TechniqueTags;
