import { GradingQueue } from '@/components/screens/grading/GradingQueue';
import { requireRole } from '@/lib/auth';
import { getGradingQueue, getGradingStats } from '@/lib/grading';

/* Cross-cohort grading queue — the instructor's single place to grade, amend,
   and release student submissions. */
export default async function GradingPage() {
  await requireRole('SUPER_ADMIN');
  const [items, stats] = await Promise.all([getGradingQueue(), getGradingStats()]);
  return <GradingQueue items={items} stats={stats} />;
}
