'use client';
import React from 'react';
import { Badge } from 'antd';
import {
  AimOutlined, BellOutlined, FileSearchOutlined, DesktopOutlined, CodeOutlined,
  RadarChartOutlined, SafetyOutlined, ExperimentOutlined, DashboardOutlined,
} from '@ant-design/icons';
import { SideShell } from '@/components/shell/SideShell';
import { AthenaData } from '@/lib/data';

/* Demo SOC console shell (mock data; instructors only — students use /learn). */
const TITLES = {
  '/scenarios': 'Scenarios', '/alerts': 'Alerts', '/logs': 'Logs', '/edr': 'Endpoint Detection & Response',
  '/osquery': 'OSQuery', '/intel': 'Threat Intelligence', '/firewall': 'Firewall & UTM', '/forensics': 'Forensics',
};

export function AppShell({ children, user }) {
  const openAlerts = AthenaData.alerts.filter((a) => a.status === 'open').length;
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const items = [
    {
      type: 'group', label: 'Operations', children: [
        { key: '/scenarios', icon: <AimOutlined />, label: 'Scenarios' },
        {
          key: '/alerts', icon: <BellOutlined />,
          label: (
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Alerts<Badge count={openAlerts} size="small" />
            </span>
          ),
        },
        { key: '/logs', icon: <FileSearchOutlined />, label: 'Logs' },
      ],
    },
    {
      type: 'group', label: 'Investigate', children: [
        { key: '/edr', icon: <DesktopOutlined />, label: 'EDR' },
        { key: '/osquery', icon: <CodeOutlined />, label: 'OSQuery' },
        { key: '/intel', icon: <RadarChartOutlined />, label: 'Threat Intel' },
      ],
    },
    {
      type: 'group', label: 'Respond', children: [
        { key: '/firewall', icon: <SafetyOutlined />, label: 'Firewall' },
        { key: '/forensics', icon: <ExperimentOutlined />, label: 'Forensics' },
      ],
    },
  ];

  return (
    <SideShell
      subtitle="Zaio SOC Lab"
      items={items}
      titles={TITLES}
      user={user}
      roleLabel={isAdmin ? 'Instructor · Admin' : 'Tier-1 · Student'}
      userMenu={isAdmin ? [{ key: '/admin', icon: <DashboardOutlined />, label: 'Instructor dashboard' }] : []}
    >
      {children}
    </SideShell>
  );
}

export default AppShell;
