'use client';
import React from 'react';
import Link from 'next/link';
import * as AC from '@/components/ds';
import { Icon } from '@/components/Icon';
import { logout } from '@/app/actions/auth';

/* Branded full-screen status page for the auth/navigation interrupts:
   401 (unauthorized — blurred backdrop + sign-in), 403 (forbidden — "not you?"),
   404 (not found). Rendered by the app-root unauthorized/forbidden/not-found
   special files. */
const VARIANTS = {
  401: { code: '401', icon: 'LockKeyhole', title: 'Sign in to continue', message: 'This area is protected. Sign in with your Athena account to view it.', blur: true },
  403: { code: '403', icon: 'ShieldX', title: "You don't have access", message: "You're signed in, but this isn't available to your account. If it belongs to a different account, sign in with that one.", blur: false },
  404: { code: '404', icon: 'Compass', title: 'Page not found', message: "The page you're looking for doesn't exist, has moved, or the link is invalid.", blur: false },
};

function BlurBackdrop() {
  // A faux, heavily-blurred dashboard so 401 reads as "content behind a login".
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', filter: 'blur(9px)', opacity: 0.6, pointerEvents: 'none', transform: 'scale(1.04)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ height: 26, width: 220, borderRadius: 8, background: 'var(--surface-inset)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 84, borderRadius: 12, background: 'var(--surface-panel)', border: '1px solid var(--border-subtle)' }} />)}
        </div>
        <div style={{ height: 150, borderRadius: 12, background: 'var(--surface-panel)', border: '1px solid var(--border-subtle)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ height: 168, borderRadius: 12, background: 'var(--surface-panel)', border: '1px solid var(--border-subtle)' }} />)}
        </div>
      </div>
    </div>
  );
}

export function StatusScreen({ variant = 404 }) {
  const v = VARIANTS[variant] || VARIANTS[404];

  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--surface-app)', overflow: 'hidden' }}>
      {/* subtle brand wash */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(90% 60% at 50% -10%, var(--brand-subtle-bg), transparent 70%)' }} />
      {v.blur && <BlurBackdrop />}

      <div style={{
        position: 'relative', width: '100%', maxWidth: 440, background: 'var(--surface-card)',
        border: '1px solid var(--border-default)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', padding: 30, textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 18 }}>
          <img src="/logo_img_white_background.png" alt="" style={{ height: 30, borderRadius: 6 }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Athena</span>
        </div>

        <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 16, display: 'grid', placeItems: 'center', background: 'var(--brand-subtle-bg)', border: '1px solid var(--brand-subtle-border)', color: 'var(--brand)' }}>
          <Icon name={v.icon} size={26} />
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginBottom: 6 }}>ERROR {v.code}</div>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>{v.title}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 22px', lineHeight: 1.55 }}>{v.message}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {variant === 401 && (
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <AC.Button variant="primary" size="lg" block leadingIcon={<Icon name="LogIn" size={16} />}>Sign in</AC.Button>
            </Link>
          )}

          {variant === 403 && (
            <>
              <Link href="/" style={{ textDecoration: 'none' }}>
                <AC.Button variant="primary" size="md" block leadingIcon={<Icon name="Home" size={15} />}>Go to your dashboard</AC.Button>
              </Link>
              <form action={logout}>
                <AC.Button type="submit" variant="ghost" size="md" block leadingIcon={<Icon name="RefreshCw" size={14} />}>Not you? Sign in with a different account</AC.Button>
              </form>
            </>
          )}

          {variant === 404 && (
            <Link href="/" style={{ textDecoration: 'none' }}>
              <AC.Button variant="primary" size="md" block leadingIcon={<Icon name="Home" size={15} />}>Back to Athena</AC.Button>
            </Link>
          )}
        </div>

        {variant === 401 && (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '16px 0 0' }}>Accounts are provisioned by your instructor.</p>
        )}
      </div>
    </div>
  );
}

export default StatusScreen;
