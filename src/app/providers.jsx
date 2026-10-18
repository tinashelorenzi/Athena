'use client';
import React from 'react';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, App } from 'antd';
import { athenaTheme } from '@/theme/antdTheme';

/* Client-side root: collects antd's CSS-in-JS during SSR (AntdRegistry), puts
   it in the `antd` cascade layer so Tailwind's preflight can't override it,
   applies the Athena theme, and mounts <App> so screens can use
   App.useApp() for message / notification / modal. */
export function Providers({ children }) {
  return (
    <AntdRegistry layer>
      <ConfigProvider theme={athenaTheme}>
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}

export default Providers;
