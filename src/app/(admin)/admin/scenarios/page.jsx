import { ScenariosList } from '@/components/screens/ScenariosList';
import { prisma } from '@/lib/db';
import { requireArchitect } from '@/lib/auth';

/* Scenario authoring index — architect-only. */
export default async function ScenariosPage() {
  await requireArchitect();

  const scenarios = await prisma.scenario.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, type: true, title: true, exposure: true, hidden: true, updatedAt: true,
      _count: { select: { endpoints: true } },
    },
  });

  const rows = scenarios.map((s) => ({
    id: s.id,
    type: s.type,
    title: s.title,
    exposure: s.exposure,
    hidden: s.hidden,
    endpoints: s._count.endpoints,
    updated: s.updatedAt.toISOString().slice(0, 10),
  }));

  return <ScenariosList scenarios={rows} />;
}
