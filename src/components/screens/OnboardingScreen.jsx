'use client';
import React, { useActionState, useState } from 'react';
import { Button, Input } from '@/components/ds';
import { Icon } from '@/components/Icon';

/* First-login setup for bulk-created students: confirm their name and, if they
   like, replace the emailed starter password. Shown at /welcome until done. */
export function OnboardingScreen({ action, email, defaultName }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [setPw, setSetPw] = useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--surface-app)', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(90% 60% at 50% -10%, var(--brand-subtle-bg), transparent 70%)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 420, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', padding: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <img src="/logo_img_white_background.png" alt="" style={{ height: 30, borderRadius: 6 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Athena</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Welcome — let’s finish setup</h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)', margin: '0 0 22px', lineHeight: 1.55 }}>
          Signing in as <strong style={{ color: 'var(--text-secondary)' }}>{email}</strong>. Set your name and you’re into the lab.
        </p>

        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Full name" name="name" defaultValue={defaultName || ''} placeholder="e.g. Amara Okafor" required autoFocus leadingIcon={<Icon name="User" size={16} />} />

          {setPw ? (
            <>
              <Input label="New password" name="password" type="password" placeholder="At least 10 characters" autoComplete="new-password" leadingIcon={<Icon name="Lock" size={16} />} />
              <Input label="Confirm password" name="confirmPassword" type="password" placeholder="Repeat it" autoComplete="new-password" leadingIcon={<Icon name="Lock" size={16} />} />
              <button type="button" onClick={() => setSetPw(false)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12.5 }}>Keep my current password</button>
            </>
          ) : (
            <button type="button" onClick={() => setSetPw(true)} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontSize: 12.5, fontWeight: 600 }}>
              <Icon name="KeyRound" size={14} /> Set a new password (optional)
            </button>
          )}

          {state?.error && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-danger, #ef4444)' }}>
              <Icon name="TriangleAlert" size={15} /> {state.error}
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" block loading={pending} trailingIcon={<Icon name="ArrowRight" size={16} />}>
            {pending ? 'Saving' : 'Enter the lab'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default OnboardingScreen;
