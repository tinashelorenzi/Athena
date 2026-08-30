import { notFound, redirect, forbidden } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isAuthorizedForScenario } from '@/lib/student';

/* Shareable scenario reference link (embed in the LMS). Resolves the token and
   routes the viewer to the right place instead of dead-ending:
     - unknown token            → 404
     - not signed in            → /login (returns here after sign-in)
     - instructor (SUPER_ADMIN) → the scenario's management page
     - student with access      → the scenario workspace (PUBLIC or cohort-bound)
     - student without access   → 403 ("not you?") */
export default async function ScenarioRefPage({ params }) {
  const { token } = await params;
  const scenario = await prisma.scenario.findUnique({ where: { refToken: token }, select: { id: true } });
  if (!scenario) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(`/s/${token}`)}`);
  if (user.role === 'SUPER_ADMIN') redirect(`/admin/scenarios/${scenario.id}`);
  if (!(await isAuthorizedForScenario(user.id, scenario.id))) forbidden();
  redirect(`/learn/${scenario.id}`);
}
