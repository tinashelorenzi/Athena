import { forbidden, notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { machineOnline } from '@/lib/labs/machines';
import { LabError, loadLabForUser, settleUserSessions, ACTIVE_STATUSES } from '@/lib/labs/sessions';
import { getOrCreateLabParams } from '@/lib/labs/params-store';
import { renderBriefFor } from '@/lib/labs/scripts';
import { buildSessionView, resultsVisible } from '@/lib/labs/views';
import { LabWorkspace } from './LabWorkspace';

/* Server half of a LAB scenario's page (/learn/[scenarioId]): the brief with
   the student's own values, their machines, and the current session. */
export async function LabWorkspacePage({ user, scenarioId }) {
  let loaded;
  try {
    loaded = await loadLabForUser(user.id, { scenarioId });
  } catch (e) {
    if (e instanceof LabError && e.code === 'forbidden') forbidden();
    if (e instanceof LabError) notFound();
    throw e;
  }
  const { lab, scenario, definition } = loaded;
  await settleUserSessions(user.id);

  const [params, machineRows, sessions, submission] = await Promise.all([
    getOrCreateLabParams(lab.id, user.id, definition),
    prisma.machine.findMany({ where: { userId: user.id, status: 'ACTIVE' }, orderBy: { enrolledAt: 'asc' } }),
    prisma.labSession.findMany({
      where: { userId: user.id, labVersion: { labId: lab.id } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { machines: { select: { role: true, machineId: true } } },
    }),
    prisma.submission.findUnique({ where: { scenarioId_studentId: { scenarioId, studentId: user.id } } }),
  ]);

  const machines = machineRows.map((m) => ({
    id: m.id,
    label: m.label,
    hostname: m.hostname,
    os: m.os,
    osVersion: m.osVersion,
    online: machineOnline(m),
    missing: definition.capabilities.filter((c) => !m.capabilities.includes(c)),
  }));

  const brief = await renderBriefFor(scenario.brief, lab.id, user.id, params);

  const current = sessions.find((s) => ACTIVE_STATUSES.includes(s.status)) ?? sessions[0] ?? null;
  const view = current ? await buildSessionView(current.id) : null;

  // Default role → machine: what the last session used, else each role's first free machine.
  const roles = Object.entries(definition.machines).map(([role, m]) => ({ role, os: m.os, versions: m.versions, packages: m.packages }));
  const defaults = {};
  const last = sessions[0];
  for (const { role } of roles) {
    const prev = last?.machines.find((m) => m.role === role)?.machineId;
    if (prev && machines.some((m) => m.id === prev)) defaults[role] = prev;
  }
  for (const { role } of roles) {
    if (defaults[role]) continue;
    const free = machines.find((m) => !Object.values(defaults).includes(m.id));
    if (free) defaults[role] = free.id;
  }

  const released = Boolean(submission?.releasedAt);
  const history = sessions
    .filter((s) => s.id !== current?.id)
    .map((s) => ({
      id: s.id,
      status: s.status,
      endedAt: s.endedAt?.toISOString() ?? s.createdAt.toISOString(),
      score: resultsVisible(definition, scenario.type, released) ? s.overrideScore ?? s.score : null,
      maxScore: resultsVisible(definition, scenario.type, released) ? s.maxScore : null,
    }));

  return (
    <LabWorkspace
      user={{ id: user.id, name: user.name }}
      scenario={{ id: scenario.id, title: scenario.title, type: scenario.type, description: scenario.description, techniques: scenario.techniques }}
      slug={lab.slug}
      brief={brief}
      roles={roles}
      policy={{ timeLimitMinutes: definition.session.timeLimitMinutes, lockdown: Boolean(definition.lifecycle.lockdown), ...definition.session.checks }}
      machines={machines}
      defaults={defaults}
      view={view}
      history={history}
      submission={submission ? {
        committed: Boolean(submission.committedAt),
        released,
        grade: released ? submission.grade : null,
        feedback: released ? submission.feedback ?? '' : '',
        fromSession: submission.labSessionId,
      } : null}
    />
  );
}

export default LabWorkspacePage;
