'use client';
import React from 'react';
import { IconButton, Avatar, Tooltip } from '@/components/ds';
import { Icon } from '@/components/Icon';
import { logout } from '@/app/actions/auth';

/* Slim top bar for the student area: brand, identity, sign out. `left` renders
   custom content (e.g. a back button + scenario title) in the workspace. */
export function StudentTopBar({ user, left }) {
  return (
    <header style={{
      height: 'var(--topbar-h)', flex: 'none', display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 18px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-panel)',
    }}>
      {left ?? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo_img_white_background.png" alt="" style={{ height: 24, borderRadius: 5 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Athena</span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>SOC Lab</span>
        </div>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{user?.name || 'Student'}</div>
          {user?.cohort && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{user.cohort}</div>}
        </div>
        <Avatar name={user?.name || 'Student'} size="sm" />
        <Tooltip content="Sign out" placement="bottom">
          <IconButton label="Sign out" onClick={() => logout()}><Icon name="LogOut" size={16} /></IconButton>
        </Tooltip>
      </div>
    </header>
  );
}

export default StudentTopBar;
