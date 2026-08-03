import { ScenarioForm } from '@/components/screens/ScenarioForm';
import { requireArchitect } from '@/lib/auth';

/* Author a new Dojo/Assessment scenario. Architect-only. */
export default async function NewScenarioPage() {
  await requireArchitect();
  return <ScenarioForm />;
}
