import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireArchitect } from '@/lib/auth';
import { editorSources } from '@/lib/labs/editor';
import { CheckEditor } from '@/components/screens/labs/admin/CheckEditor';

export const metadata = { title: 'Check editor — Athena' };

/* In-browser check editor for a LAB scenario — architect-only. */
export default async function LabEditorPage({ params }) {
  await requireArchitect();
  const { id } = await params;
  const lab = await prisma.lab.findUnique({ where: { scenarioId: id }, include: { scenario: { select: { title: true } } } });
  if (!lab) notFound();
  const sources = await editorSources(lab.id);
  return <CheckEditor scenarioId={id} labId={lab.id} slug={lab.slug} title={lab.scenario.title} initial={sources} />;
}
