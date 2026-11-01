import { StaffManager } from '@/components/screens/StaffManager';
import { requireArchitect } from '@/lib/auth';
import { listStaff } from '@/lib/staff';

/* Staff: architects manage instructor accounts (create, edit, architect
   permission, password reset, sign-out, deactivate, delete). Rules in
   @/lib/staff, mutations in @/app/actions/staff. */
export default async function StaffPage() {
  const me = await requireArchitect();
  return <StaffManager staff={await listStaff()} meId={me.id} />;
}
