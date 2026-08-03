'use client';
import React, { useEffect } from 'react';
import { useActionState } from 'react';
import { Button as LB, Input as LI } from '@/components/ds';
import { Icon } from '@/components/Icon';

/* Athena login — split brand panel + sign-in form. No registration.
   Same form for instructors and students; the server action redirects each
   role to the right home (instructor → /admin, student → /alerts). When
   Cloudflare Turnstile is enabled in platform settings, the widget is rendered
   inside the form and its token is verified server-side by the login action. */
export function LoginScreen({ action, turnstile }) {
  const [state, formAction, pending] = useActionState(action, {});
  const turnstileEnabled = Boolean(turnstile?.enabled && turnstile?.siteKey);

  // Load the Turnstile script once when the challenge is enabled. The script
  // auto-renders any `.cf-turnstile` element and injects a hidden
  // `cf-turnstile-response` input into the surrounding form.
  useEffect(() => {
    if (!turnstileEnabled) return;
    const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    if (document.querySelector(`script[src="${SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }, [turnstileEnabled]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--surface-app)' }}>
      {/* Brand panel */}
      <div style={{
        flex: '1.15', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '48px 52px',
        background: 'radial-gradient(120% 90% at 15% 0%, rgba(35,38,184,0.28), transparent 60%), linear-gradient(180deg, #0c0e1e, #06070f)',
        borderRight: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.5,
          backgroundImage: 'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
          backgroundSize: '46px 46px', maskImage: 'radial-gradient(90% 70% at 30% 30%, #000, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(90% 70% at 30% 30%, #000, transparent 75%)',
        }} />
        <img src="/logo.1a24392f.png" alt="Zaio Institute of Technology" style={{ height: 30, width: 'auto', position: 'relative', alignSelf: 'flex-start' }} />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 11px', borderRadius: 999, background: 'var(--brand-subtle-bg)', border: '1px solid var(--brand-subtle-border)', marginBottom: 22 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--status-success)', boxShadow: '0 0 8px var(--status-success)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-200)', letterSpacing: '0.02em' }}>SOC Simulation Lab · Live</span>
          </div>
          <h1 style={{ fontSize: 46, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', margin: '0 0 16px', maxWidth: 520 }}>
            Train like the alert is <span style={{ color: 'var(--accent)' }}>real.</span>
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, maxWidth: 460 }}>
            Athena drops you into realistic incident-response scenarios — triage alerts, hunt through logs, isolate endpoints, and write the firewall rule that stops the bleed.
          </p>
          <div style={{ display: 'flex', gap: 28, marginTop: 34 }}>
            {[['Scenarios', '18'], ['Detections', '240+'], ['Avg. session', '52m']].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600, color: '#fff' }}>{v}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{k}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', fontSize: 12, color: 'var(--text-tertiary)' }}>© 2026 Zaio Institute of Technology · For authorized students only</div>
      </div>

      {/* Form panel */}
      <div style={{ flex: '0.85', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 28 }}>
            <img src="/logo_img_white_background.png" alt="" style={{ height: 40, borderRadius: 8 }} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>Athena</div>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Zaio SOC Lab</div>
            </div>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Sign in</h2>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: '0 0 24px' }}>Use the credentials issued by your instructor.</p>

          <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <LI label="Email" name="email" type="email" autoComplete="username" placeholder="you@zaio.io" required leadingIcon={<Icon name="Mail" size={16} />} />
            <div>
              <LI label="Password" name="password" type="password" autoComplete="current-password" placeholder="Your password" required leadingIcon={<Icon name="Lock" size={16} />} />
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <a href="#" style={{ fontSize: 13 }}>Forgot password?</a>
              </div>
            </div>

            {turnstileEnabled && (
              <div className="cf-turnstile" data-sitekey={turnstile.siteKey} data-theme="dark" />
            )}

            {state?.error && (
              <div role="alert" style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-subtle-bg, rgba(239,68,68,0.12))', border: '1px solid var(--danger-subtle-border, rgba(239,68,68,0.35))',
              }}>
                <Icon name="TriangleAlert" size={15} style={{ color: 'var(--status-danger, #ef4444)', flex: 'none' }} />
                <span style={{ fontSize: 13, color: 'var(--status-danger, #ef4444)' }}>{state.error}</span>
              </div>
            )}

            <LB variant="primary" size="lg" block loading={pending} type="submit">
              {pending ? 'Authenticating' : 'Sign in to Athena'}
            </LB>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, padding: '11px 13px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-card)', border: '1px solid var(--border-default)' }}>
            <Icon name="Info" size={15} style={{ color: 'var(--text-tertiary)', flex: 'none', marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>No public sign-up. Accounts are provisioned by your instructor — contact them for access.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
