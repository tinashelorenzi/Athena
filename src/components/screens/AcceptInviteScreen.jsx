'use client';
import React, { useActionState } from 'react';
import { Button as LB, Input as LI } from '@/components/ds';
import { Icon } from '@/components/Icon';

/* Invitation acceptance — set name + password to activate a STUDENT account.
   On success the action creates the account, opens a session, and redirects. */
export function AcceptInviteScreen({ valid, email, cohortName, action }) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(120% 90% at 50% 0%, rgba(35,38,184,0.22), transparent 60%), var(--surface-app)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 24, justifyContent: 'center' }}>
          <img src="/logo_img_white_background.png" alt="" style={{ height: 40, borderRadius: 8 }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>Athena</div>
            <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Zaio SOC Lab</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface-panel)', border: '1px solid var(--border-default)', borderRadius: 14, padding: 28 }}>
          {!valid ? (
            <div style={{ textAlign: 'center' }}>
              <Icon name="LinkOff" size={26} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>Invitation not valid</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.6 }}>This invitation link is invalid, already used, or expired. Ask your instructor to re-send it.</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Set up your account</h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-tertiary)', margin: '0 0 20px' }}>
                Activating <strong style={{ color: 'var(--text-secondary)' }}>{email}</strong>{cohortName ? <> · cohort <strong style={{ color: 'var(--text-secondary)' }}>{cohortName}</strong></> : null}
              </p>

              <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <LI label="Your name" name="name" required placeholder="Ada Lovelace" leadingIcon={<Icon name="User" size={16} />} />
                <LI label="Password" name="password" type="password" autoComplete="new-password" required leadingIcon={<Icon name="Lock" size={16} />} />
                <LI label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" required leadingIcon={<Icon name="Lock" size={16} />} />

                {state?.error && (
                  <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--status-danger, #ef4444)' }}>
                    <Icon name="TriangleAlert" size={15} /> {state.error}
                  </div>
                )}

                <LB variant="primary" size="lg" block loading={pending} type="submit">
                  {pending ? 'Setting up' : 'Activate account'}
                </LB>
                <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', margin: 0, textAlign: 'center' }}>Password must be at least 10 characters.</p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AcceptInviteScreen;
