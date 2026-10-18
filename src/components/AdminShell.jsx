'use client';
import React from 'react';
import {
  DashboardOutlined, TeamOutlined, ApartmentOutlined, EditOutlined, ProfileOutlined,
  AppstoreOutlined, SettingOutlined, AimOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { SideShell } from '@/components/shell/SideShell';

/* Instructor (SUPER_ADMIN) dashboard shell. */
const TITLES = {
  '/admin': 'Instructor Dashboard',
  '/admin/students': 'Student Management',
  '/admin/cohorts': 'Cohorts',
  '/admin/grading': 'Grading Queue',
  '/admin/assignments': 'Assignment Scenarios',
  '/admin/scenarios': 'Scenario Authoring',
  '/admin/settings': 'Settings',
  '/attack': 'MITRE ATT&CK Explorer',
};

export function AdminShell({ children, user }) {
  const isArchitect = Boolean(user?.isArchitect);
  const items = [
    {
      type: 'group', label: 'Instructor', children: [
        { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard' },
        { key: '/admin/students', icon: <TeamOutlined />, label: 'Students' },
        { key: '/admin/cohorts', icon: <ApartmentOutlined />, label: 'Cohorts' },
        { key: '/admin/grading', icon: <EditOutlined />, label: 'Grading' },
        { key: '/admin/assignments', icon: <ProfileOutlined />, label: 'Assignments' },
      ],
    },
    isArchitect && {
      type: 'group', label: 'Authoring', children: [
        { key: '/admin/scenarios', icon: <AppstoreOutlined />, label: 'Scenarios' },
      ],
    },
    {
      type: 'group', label: 'Knowledge', children: [
        { key: '/attack', icon: <AimOutlined />, label: 'ATT&CK Explorer' },
      ],
    },
    {
      type: 'group', label: 'Configuration', children: [
        { key: '/admin/settings', icon: <SettingOutlined />, label: 'Settings' },
      ],
    },
  ].filter(Boolean);

  return (
    <SideShell
      subtitle="Instructor Console"
      items={items}
      titles={TITLES}
      user={user}
      roleLabel="Instructor · Admin"
      userMenu={[
        { key: '/alerts', icon: <ExperimentOutlined />, label: 'Demo SOC console' },
      ]}
    >
      {children}
    </SideShell>
  );
}

export default AdminShell;
