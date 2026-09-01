import { GradingQueue } from '@/components/screens/grading/GradingQueue';
import { requireRole } from '@/lib/auth';
import { getGradingQueue } from '@/lib/grading';

/* Cross-cohort grading queue — the instructor's single place to commit, grade,
   amend, and release student submissions. */
export default async function GradingPage() {
  await requireRole('SUPER_ADMIN');
  const items = await getGradingQueue();
  return <GradingQueue items={items} />;
}
