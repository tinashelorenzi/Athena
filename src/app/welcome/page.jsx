import { redirect } from 'next/navigation';
import { OnboardingScreen } from '@/components/screens/OnboardingScreen';
import { requireUser, homeForRole } from '@/lib/auth';
import { completeOnboarding } from '@/app/actions/onboarding';

/* First-login setup for bulk-created students (mustSetName). Anyone already set
   up (or an instructor) is bounced to their home. */
export default async function WelcomePage() {
  const user = await requireUser();
  if (!user.mustSetName) redirect(homeForRole(user.role));
  return <OnboardingScreen action={completeOnboarding} email={user.email} defaultName={user.name} />;
}
