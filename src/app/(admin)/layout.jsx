import { AdminShell } from '@/components/AdminShell';
import { requireRole } from '@/lib/auth';

/* Instructor-only area. requireRole redirects unauthenticated users to /login
   and non-instructors to their own home before anything renders. */
export default async function AdminLayout({ children }) {
  const user = await requireRole('SUPER_ADMIN');
  return <AdminShell user={user}>{children}</AdminShell>;
}
