import { AutoBuilder } from '@/components/screens/AutoBuilder';
import { requireArchitect } from '@/lib/auth';

/* Auto-build a scenario from a dropped folder. Architect-only. */
export default async function AutoBuildPage() {
  await requireArchitect();
  return <AutoBuilder />;
}
