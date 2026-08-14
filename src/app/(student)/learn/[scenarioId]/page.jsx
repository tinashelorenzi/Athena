import { notFound } from 'next/navigation';
import { ScenarioWorkspace } from '@/components/screens/student/ScenarioWorkspace';
import { requireUser } from '@/lib/auth';
import { getStudentScenario, ensureProgress, publicFlags } from '@/lib/student';
import { publicPrompts } from '@/lib/guide';
import { prisma } from '@/lib/db';
import { tickAndReadRun } from '@/lib/run-engine';

/* Student scenario workspace — the SIEM-like environment for one scenario.
   Authorization (cohort must be bound to the scenario) happens in
   getStudentScenario; flag answers are stripped before reaching the client. */
export default async function ScenarioWorkspacePage({ params }) {
  const user = await requireUser();
  const { scenarioId } = await params;

  const data = await getStudentScenario(user.id, scenarioId);
  if (!data) notFound();

  const startedAt = await ensureProgress(user.id, scenarioId);
  const { scenario, submission } = data;

  const view = {
    id: scenario.id,
    title: scenario.title,
    type: scenario.type,
    realtime: scenario.realtime,
    description: scenario.description,
    brief: scenario.brief,
    objectives: scenario.objectives || [],
    flags: publicFlags(scenario.flags),
    reportRequired: scenario.reportRequired,
    reportPrompt: scenario.reportPrompt || '',
    logs: scenario.logs || null,
    alerts: scenario.alerts || null,
    endpoints: scenario.endpoints.map((e) => ({
      id: e.id,
      hostname: e.hostname,
      edr: e.edr || null,
      osquery: e.osquery || null,
      artifactName: e.artifactName,
      artifactSize: e.artifactSize,
      hasArtifact: Boolean(e.artifactKey),
    })),
    startedAt: startedAt.toISOString(),
    hasGuide: Boolean(scenario.guide),
    guide: scenario.guide || '',
    guidePrompts: publicPrompts(scenario.guidePrompts),
  };

  const guideSolves = scenario.guide
    ? await prisma.guidePromptSolve.findMany({ where: { studentId: user.id, scenarioId }, select: { promptId: true } })
    : [];
  const solvedIds = guideSolves.map((s) => s.promptId);

  // Dojo flags are self-checked individually; load which the student has solved.
  const flagSolves = scenario.type === 'DOJO'
    ? await prisma.flagSolve.findMany({ where: { studentId: user.id, scenarioId }, select: { flagId: true } })
    : [];
  const solvedFlagIds = flagSolves.map((s) => s.flagId);

  // The student's existing case work, keyed by alert id.
  const caseRows = await prisma.alertCase.findMany({
    where: { studentId: user.id, scenarioId },
    select: { alertId: true, verdict: true, status: true, notes: true, iocs: true },
  });
  const cases = Object.fromEntries(
    caseRows.map((c) => [c.alertId, { verdict: c.verdict, status: c.status, notes: c.notes || '', iocs: Array.isArray(c.iocs) ? c.iocs : [] }]),
  );

  // The grade/feedback stay hidden until the instructor releases them.
  const released = submission ? submission.releasedAt != null : false;
  const sub = submission
    ? {
        id: submission.id,
        report: submission.report || '',
        reportFileName: submission.reportFileName || '',
        flagAnswers: submission.flagAnswers || {},
        status: released ? 'GRADED' : 'SUBMITTED',
        grade: released ? submission.grade : null,
        feedback: released ? (submission.feedback || '') : '',
        submittedAt: submission.submittedAt.toISOString(),
      }
    : null;

  // Current run + initial fired feed (a catch-up materialization runs here too).
  const run = await prisma.scenarioRun.findUnique({
    where: { scenarioId_studentId: { scenarioId, studentId: user.id } },
  });
  let initialRun = { status: 'NONE', elapsed: 0, alerts: [], logs: [], startedAt: null };
  if (run) {
    const { elapsed, alerts, logs } = await tickAndReadRun(run);
    initialRun = { status: run.status, elapsed, alerts, logs, startedAt: run.startedAt.toISOString() };
  }

  return <ScenarioWorkspace user={{ name: user.name }} scenario={view} submission={sub} initialRun={initialRun} solvedIds={solvedIds} solvedFlagIds={solvedFlagIds} initialCases={cases} />;
}
