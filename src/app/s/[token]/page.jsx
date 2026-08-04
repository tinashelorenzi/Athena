import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

/* Shareable scenario reference link (embed in the LMS). Resolves the token to
   the scenario and forwards to the workspace, which enforces auth + cohort
   authorization — so an authorized, logged-in student lands straight in it. */
export default async function ScenarioRefPage({ params }) {
  const { token } = await params;
  const scenario = await prisma.scenario.findUnique({ where: { refToken: token }, select: { id: true } });
  if (!scenario) notFound();
  redirect(`/learn/${scenario.id}`);
}
