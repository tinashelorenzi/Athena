'use client';
import React, { useEffect, useRef } from 'react';
import { useActionState } from 'react';
import { Row, Col, Form, Input, Button, Alert, Divider, Flex, Typography, theme } from 'antd';
import { MailOutlined, LockOutlined, InfoCircleOutlined } from '@ant-design/icons';

/* Athena login — split brand panel + sign-in form. No registration.
   Same form for instructors and students; the server action redirects each
   role to the right home (instructor → /admin, student → /alerts). When
   Cloudflare Turnstile is enabled in platform settings, the widget is rendered
   inside the form and its token is verified server-side by the login action.
   The form stays a native <form action> (antd inputs carry `name`s) so the
   server action + useActionState flow is unchanged. */
const BRAND_BLUE = '#2326B8';
const BRAND_YELLOW = '#F9C80E';

const SSO_ERRORS = {
  invalid_state: 'Zaio sign-in expired. Please try again.',
  missing_code: 'Zaio did not return an authorization code.',
  sso_disabled: 'Zaio sign-in is not configured on this server.',
};

function BrandPanel() {
  return (
    <Flex
      vertical
      justify="space-between"
      style={{
        position: 'relative', overflow: 'hidden', height: '100%', padding: '48px 52px',
        background: `radial-gradient(120% 90% at 15% 0%, rgba(35,38,184,0.55), transparent 60%), linear-gradient(180deg, #0c0e1e, #06070f)`,
      }}
    >
      <div aria-hidden style={{
        position: 'absolute', inset: 0, opacity: 0.35,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
        backgroundSize: '46px 46px', maskImage: 'radial-gradient(90% 70% at 30% 30%, #000, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(90% 70% at 30% 30%, #000, transparent 75%)',
      }} />
      <img src="/logo.1a24392f.png" alt="Zaio Institute of Technology" style={{ height: 30, width: 'auto', position: 'relative', alignSelf: 'flex-start' }} />

      <div style={{ position: 'relative' }}>
        <Flex align="center" gap={8} style={{ display: 'inline-flex', padding: '5px 12px', borderRadius: 999, background: 'rgba(35,38,184,0.35)', border: '1px solid rgba(124,127,245,0.45)', marginBottom: 22 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: '#2ED47A', boxShadow: '0 0 8px #2ED47A' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#C9CBFF', letterSpacing: '0.02em' }}>SOC Simulation Lab · Live</span>
        </Flex>
        <h1 style={{ fontSize: 46, lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', margin: '0 0 16px', maxWidth: 520 }}>
          Train like the alert is <span style={{ color: BRAND_YELLOW }}>real.</span>
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.74)', margin: 0, maxWidth: 460 }}>
          Athena drops you into realistic incident-response scenarios — triage alerts, hunt through logs, isolate endpoints, and write the firewall rule that stops the bleed.
        </p>
        <Flex gap={28} style={{ marginTop: 34 }}>
          {[['Scenarios', '18'], ['Detections', '240+'], ['Avg. session', '52m']].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 24, fontWeight: 600, color: '#fff' }}>{v}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{k}</div>
            </div>
          ))}
        </Flex>
      </div>

      <div style={{ position: 'relative', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>© 2026 Zaio Institute of Technology · For authorized students only</div>
    </Flex>
  );
}

export function LoginScreen({ action, turnstile, zaioSso, ssoError, returnTo }) {
  const { token } = theme.useToken();
  const zaioLoginHref = zaioSso?.loginUrl
    ? (returnTo ? `${zaioSso.loginUrl}?returnTo=${encodeURIComponent(returnTo)}` : zaioSso.loginUrl)
    : undefined;
  const [state, formAction, pending] = useActionState(action, {});
  const turnstileEnabled = Boolean(turnstile?.enabled && turnstile?.siteKey);
  const boxRef = useRef(null);
  const widgetId = useRef(null);

  // Render Turnstile *explicitly* rather than relying on the script's one-time
  // auto-scan of `.cf-turnstile` elements. The auto-scan only fires on the
  // script's initial load, so after a client-side navigation (e.g. logout →
  // /login) the already-loaded script never renders the freshly-mounted widget
  // — which is why it previously needed a hard refresh. Explicit render works
  // on every mount.
  useEffect(() => {
    if (!turnstileEnabled) return;
    const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    let poll;

    const render = () => {
      if (!boxRef.current || widgetId.current != null) return;
      if (!window.turnstile) return;
      widgetId.current = window.turnstile.render(boxRef.current, {
        sitekey: turnstile.siteKey,
        theme: 'light',
      });
    };

    if (window.turnstile) {
      render();
    } else {
      if (!document.querySelector(`script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]`)) {
        const s = document.createElement('script');
        s.src = SRC;
        s.async = true;
        s.defer = true;
        s.onload = render;
        document.head.appendChild(s);
      }
      // Script tag exists but the API may not be ready yet — wait for it.
      poll = setInterval(() => { if (window.turnstile) { clearInterval(poll); render(); } }, 120);
    }

    return () => {
      if (poll) clearInterval(poll);
      if (widgetId.current != null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* already gone */ }
      }
      widgetId.current = null;
    };
  }, [turnstileEnabled, turnstile?.siteKey]);

  return (
    <Row style={{ minHeight: '100vh', background: token.colorBgContainer }}>
      {/* Brand panel (hidden on small screens) */}
      <Col xs={0} lg={13}>
        <BrandPanel />
      </Col>

      {/* Form panel */}
      <Col xs={24} lg={11}>
        <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 40 }}>
          <div style={{ width: '100%', maxWidth: 360 }}>
            <Flex align="center" gap={11} style={{ marginBottom: 28 }}>
              <img src="/logo_img_white_background.png" alt="" style={{ height: 40, borderRadius: 8 }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: BRAND_BLUE, letterSpacing: '-0.01em', lineHeight: 1.1 }}>Athena</div>
                <Typography.Text type="secondary" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Zaio SOC Lab</Typography.Text>
              </div>
            </Flex>

            <Typography.Title level={3} style={{ margin: '0 0 4px' }}>Sign in</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>Use the credentials issued by your instructor.</Typography.Paragraph>

            <form action={formAction}>
              {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
              <Form layout="vertical" component={false} requiredMark={false}>
                <Form.Item label="Email" htmlFor="login-email">
                  <Input id="login-email" name="email" type="email" autoComplete="username" placeholder="you@zaio.io" required size="large" prefix={<MailOutlined style={{ color: token.colorTextTertiary }} />} />
                </Form.Item>
                <Form.Item
                  label="Password"
                  htmlFor="login-password"
                  extra={<div style={{ textAlign: 'right', marginTop: 6 }}><Typography.Link href="#" style={{ fontSize: 13 }}>Forgot password?</Typography.Link></div>}
                >
                  <Input.Password id="login-password" name="password" autoComplete="current-password" placeholder="Your password" required size="large" prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />} />
                </Form.Item>
              </Form>

              <Flex vertical gap={16}>
                {turnstileEnabled && <div ref={boxRef} style={{ minHeight: 65 }} />}

                {state?.error && <Alert type="error" showIcon title={state.error} role="alert" />}

                {ssoError && !state?.error && (
                  <Alert type="error" showIcon role="alert" title={SSO_ERRORS[ssoError] || `Zaio sign-in failed: ${ssoError}`} />
                )}

                <Button type="primary" htmlType="submit" size="large" block loading={pending}>
                  {pending ? 'Authenticating' : 'Sign in to Athena'}
                </Button>
              </Flex>
            </form>

            {zaioSso?.enabled && (
              <>
                <Divider plain style={{ margin: '16px 0' }}><Typography.Text type="secondary" style={{ fontSize: 12 }}>or</Typography.Text></Divider>
                <Button href={zaioLoginHref} size="large" block>Continue with Zaio LMS</Button>
              </>
            )}

            <Alert
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              style={{ marginTop: 24 }}
              title={
                <span style={{ fontSize: 12.5 }}>
                  {zaioSso?.enabled
                    ? 'Instructors: use the email and password issued to you. Students with a Zaio LMS account can use Continue with Zaio LMS above.'
                    : 'No public sign-up. Accounts are provisioned by your instructor — contact them for access.'}
                </span>
              }
            />
          </div>
        </Flex>
      </Col>
    </Row>
  );
}

export default LoginScreen;
