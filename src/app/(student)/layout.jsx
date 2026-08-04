import { requireUser } from '@/lib/auth';

/* Student area gate. Any authenticated user may enter; the scenario list is
   scoped to their cohort (instructors simply see an empty list here). */
export default async function StudentLayout({ children }) {
  await requireUser();
  return children;
}
