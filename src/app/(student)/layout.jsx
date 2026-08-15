import { requireUser } from '@/lib/auth';
import { StudentAlertToaster } from '@/components/StudentAlertToaster';

/* Student area gate. Any authenticated user may enter; the scenario list is
   scoped to their cohort (instructors simply see an empty list here). The
   toaster raises live alert notifications app-wide (students only). */
export default async function StudentLayout({ children }) {
  const user = await requireUser();
  return (
    <>
      {children}
      {user.role === 'STUDENT' && <StudentAlertToaster />}
    </>
  );
}
