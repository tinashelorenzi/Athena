import { notFound } from 'next/navigation';
import { ScenarioEditor } from '@/components/screens/ScenarioEditor';
import { prisma } from '@/lib/db';
import { requireArchitect } from '@/lib/auth';
import { ensureRefToken } from '@/lib/scenarios';

/* Scenario detail / editor — architect-only. Edit basics + manage endpoints. */
export default async function ScenarioDetailPage({ params }) {
  await requireArchitect();
  const { id } = await params;

  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: { endpoints: { orderBy: { hostname: 'asc' } } },
  });
  if (!scenario) notFound();

  const refToken = await ensureRefToken(scenario.id);

  const view = {
    id: scenario.id,
    refToken,
    type: scenario.type,
    title: scenario.title,
    description: scenario.description,
    exposure: scenario.exposure,
    hidden: scenario.hidden,
    brief: scenario.brief,
    objectives: scenario.objectives || [],
    flags: scenario.flags || [],
    reportRequired: scenario.reportRequired,
    reportPrompt: scenario.reportPrompt || '',
    hasLogs: scenario.logs != null,
    hasAlerts: scenario.alerts != null,
    guideStatus: scenario.guide
      ? {
          has: true,
          promptCount: Array.isArray(scenario.guidePrompts) ? scenario.guidePrompts.length : 0,
          assetCount: Array.isArray(scenario.guideAssets) ? scenario.guideAssets.length : 0,
        }
      : { has: false, promptCount: 0, assetCount: 0 },
    // Instructor preview (answers included — instructor-side only).
    guidePreview: scenario.guide
      ? { markdown: scenario.guide, prompts: Array.isArray(scenario.guidePrompts) ? scenario.guidePrompts : [] }
      : null,
  };

  const endpoints = scenario.endpoints.map((e) => ({
    id: e.id,
    hostname: e.hostname,
    hasEdr: e.edr != null,
    hasOsquery: e.osquery != null,
    artifactName: e.artifactName,
    artifactSize: e.artifactSize,
  }));

  return <ScenarioEditor scenario={view} endpoints={endpoints} />;
}
