'use client';
import React from 'react';
import { Breadcrumb as AntBreadcrumb } from 'antd';

/* antd Breadcrumb. items: [{ id?, label }]; onNavigate(id ?? label) for every
   item except the last (current page). */
export function Breadcrumb({ items = [], onNavigate, ...rest }) {
  return (
    <AntBreadcrumb
      {...rest}
      items={items.map((it, i) => {
        const last = i === items.length - 1;
        return last
          ? { title: <span aria-current="page">{it.label}</span> }
          : {
              title: it.label,
              href: '#',
              onClick: (e) => { e.preventDefault(); if (onNavigate) onNavigate(it.id ?? it.label); },
            };
      })}
    />
  );
}
