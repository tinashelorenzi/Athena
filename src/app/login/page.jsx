import { redirect } from 'next/navigation';
import { LoginScreen } from '@/components/screens/LoginScreen';
import { getCurrentUser, homeForRole } from '@/lib/auth';
import { getTurnstilePublic } from '@/lib/settings';
import { getZaioSsoPublicConfig } from '@/lib/zaio-sso';
import { login } from '@/app/actions/auth';

export default async function LoginPage({ searchParams }) {
  // Already signed in? Skip the form and go to the role's home.
  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));

  const turnstile = await getTurnstilePublic();
  const zaioSso = getZaioSsoPublicConfig();
  const params = await searchParams;
  const ssoError = typeof params?.error === 'string' ? params.error : undefined;

  return (
    <LoginScreen
      action={login}
      turnstile={turnstile}
      zaioSso={zaioSso}
      ssoError={ssoError}
    />
  );
}
