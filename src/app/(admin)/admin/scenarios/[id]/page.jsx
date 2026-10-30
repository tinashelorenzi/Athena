import { notFound } from 'next/navigation';
import { ScenarioEditor } from '@/components/screens/ScenarioEditor';
import { prisma } from '@/lib/db';
import { requireArchitect } from '@/lib/auth';
import { ensureRefToken } from '@/lib/scenarios';
import { LabOverview } from '@/components/screens/labs/LabOverview';
import { briefScriptNames, renderBriefFor } from '@/lib/labs/scripts';
import { listLabSessions } from '@/lib/labs/admin';
import { getBaseUrl } from '@/lib/url';

/* Scenario detail / editor — architect-only. Edit basics + manage endpoints. */
export default async function ScenarioDetailPage({ params }) {
  const user = await requireArchitect();
  const { id } = await params;

  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: {
      endpoints: { orderBy: { hostname: 'asc' } },
      lab: { include: { versions: { orderBy: { version: 'desc' } }, scripts: { orderBy: { name: 'asc' }, include: { _count: { select: { links: true } } } } } },
      cohorts: { select: { cohortId: true } },
    },
  });
  if (!scenario) notFound();

  const refToken = await ensureRefToken(scenario.id);

  if (scenario.kind === 'LAB' && scenario.lab) {
    const [latest] = scenario.lab.versions;
    const definition = latest?.definition ?? null;
    // Show the brief as a student with the good reference's values would see it. Script
    // links are the instructor's own, so running one on an answer-key VM gets their values.
    const refParams = latest?.gate?.referenceParams ?? null;
    const [cohorts, baseUrl, brief] = await Promise.all([
      prisma.cohort.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      getBaseUrl(),
      renderBriefFor(scenario.brief, scenario.lab.id, user.id, refParams),
    ]);
    return (
      <LabOverview
        scenario={{
          id: scenario.id, title: scenario.title, description: scenario.description, type: scenario.type,
          exposure: scenario.exposure, hidden: scenario.hidden, techniques: scenario.techniques, refToken,
          brief,
        }}
        labId={scenario.lab.id}
        slug={scenario.lab.slug}
        sessions={await listLabSessions(scenario.lab.id)}
        visibility={{ cohorts, released: scenario.cohorts.map((b) => b.cohortId), studentUrl: `${baseUrl}/learn/${scenario.id}` }}
        definition={definition}
        gate={latest?.gate ?? null}
        assets={latest?.assets ?? []}
        scripts={scenario.lab.scripts.map((s) => ({ name: s.name, content: s.content, updatedAt: s.updatedAt.toISOString(), links: s._count.links, inBrief: briefScriptNames(scenario.brief).includes(s.name) }))}
        params={Object.keys(definition?.params ?? {})}
        versions={scenario.lab.versions.map((v) => ({ version: v.version, draft: v.draft, createdAt: v.createdAt.toISOString(), score: v.gate?.good?.score ?? null, maxScore: v.gate?.good?.maxScore ?? null }))}
      />
    );
  }

  const view = {
    id: scenario.id,
    refToken,
    type: scenario.type,
    title: scenario.title,
    description: scenario.description,
    exposure: scenario.exposure,
    hidden: scenario.hidden,
    realtime: scenario.realtime,
    brief: scenario.brief,
    objectives: scenario.objectives || [],
    flags: scenario.flags || [],
    techniques: scenario.techniques,
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
