import { redirect } from 'next/navigation';
import { LoginScreen } from '@/components/screens/LoginScreen';
import { getCurrentUser, homeForRole } from '@/lib/auth';
import { getTurnstilePublic } from '@/lib/settings';
import { getZaioSsoPublicConfig } from '@/lib/zaio-sso';
import { login } from '@/app/actions/auth';

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const rawReturn = typeof params?.returnTo === 'string' ? params.returnTo : '';
  const returnTo = rawReturn.startsWith('/') && !rawReturn.startsWith('//') ? rawReturn : '';

  // Already signed in? Skip the form and go where they were headed (or home).
  const user = await getCurrentUser();
  if (user) redirect(returnTo || homeForRole(user.role));

  const turnstile = await getTurnstilePublic();
  const zaioSso = getZaioSsoPublicConfig();
  const ssoError = typeof params?.error === 'string' ? params.error : undefined;

  return (
    <LoginScreen
      action={login}
      turnstile={turnstile}
      zaioSso={zaioSso}
      ssoError={ssoError}
      returnTo={returnTo}
    />
  );
}
