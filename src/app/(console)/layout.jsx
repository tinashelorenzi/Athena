import { AppShell } from '@/components/AppShell';
import { requireUser } from '@/lib/auth';

/* Authenticated console shell. Server-side gate: unauthenticated users are
   redirected to /login by requireUser(). The resolved user is handed to the
   (client) AppShell for the footer + sign-out. Any authenticated role may use
   the console; instructors are sent to /admin at login but can still view it. */
export default async function ConsoleLayout({ children }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
