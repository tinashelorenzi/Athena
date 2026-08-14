import { notFound } from 'next/navigation';
import { ScenarioWorkspace } from '@/components/screens/student/ScenarioWorkspace';
import { requireArchitect } from '@/lib/auth';
import { publicFlags } from '@/lib/student';
import { prisma } from '@/lib/db';

/* Instructor preview — play a scenario as a student would, fully client-side and
   ephemeral (no run/cases/submission persisted). Architect-only. */
export default async function ScenarioPreviewPage({ params }) {
  const user = await requireArchitect();
  const { id } = await params;

  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: { endpoints: { orderBy: { hostname: 'asc' } } },
  });
  if (!scenario) notFound();

  const view = {
    id: scenario.id,
    type: scenario.type,
    realtime: scenario.realtime,
    title: scenario.title,
    description: scenario.description,
    brief: scenario.brief,
    objectives: scenario.objectives || [],
    // Preview includes the answers so Dojo flags can be checked locally.
    flags: publicFlags(scenario.flags).map((f) => {
      const raw = (Array.isArray(scenario.flags) ? scenario.flags : []).find((x, i) => String(x?.id ?? `f${i + 1}`) === f.id);
      return { ...f, answer: raw?.answer ?? '' };
    }),
    reportRequired: scenario.reportRequired,
    reportPrompt: scenario.reportPrompt || '',
    endpoints: scenario.endpoints.map((e) => ({
      id: e.id, hostname: e.hostname, edr: e.edr || null, osquery: e.osquery || null,
      artifactName: e.artifactName, artifactSize: e.artifactSize, hasArtifact: Boolean(e.artifactKey),
    })),
    hasGuide: Boolean(scenario.guide),
    guide: scenario.guide || '',
    // Preview includes the answers so guide prompts can be checked locally.
    guidePrompts: Array.isArray(scenario.guidePrompts) ? scenario.guidePrompts : [],
    // Raw bundles for client-side feed playback.
    rawAlerts: scenario.alerts || null,
    rawLogs: scenario.logs || null,
    startedAt: null,
  };

  const initialRun = { status: 'NONE', elapsed: 0, alerts: [], logs: [], startedAt: null };

  return (
    <ScenarioWorkspace
      preview
      user={{ name: `${user.name} (preview)` }}
      scenario={view}
      submission={null}
      initialRun={initialRun}
      solvedIds={[]}
      solvedFlagIds={[]}
      initialCases={{}}
    />
  );
}
