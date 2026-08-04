import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { requireUser } from '@/lib/auth';

/* The original mock SIEM console (demo data). Students now have their own
   scenario-driven experience under /learn, so they're redirected there;
   instructors may still browse the console as a reference. */
export default async function ConsoleLayout({ children }) {
  const user = await requireUser();
  if (user.role === 'STUDENT') redirect('/learn');
  return <AppShell user={user}>{children}</AppShell>;
}
