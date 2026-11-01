"use server";

import { revalidatePath } from "next/cache";
import { requireArchitect } from "@/lib/auth";
import {
  createStaffAs, deleteStaffAs, resetStaffPasswordAs, setStaffDisabledAs, signOutStaffAs, updateStaffAs, type StaffResult,
} from "@/lib/staff";

/* Staff page (/admin/staff): architects manage instructor accounts. The rules
   live in src/lib/staff.ts. */

async function run<T extends object>(fn: (actorId: string) => Promise<StaffResult<T>>): Promise<StaffResult<T>> {
  const user = await requireArchitect();
  const res = await fn(user.id);
  if (res.ok) revalidatePath("/admin/staff");
  return res;
}

export async function createStaff(input: { name: string; email: string; password?: string; isArchitect?: boolean }) {
  return run((actor) => createStaffAs(actor, input));
}

export async function updateStaff(id: string, input: { name?: string; email?: string; isArchitect?: boolean }) {
  return run((actor) => updateStaffAs(actor, id, input));
}

export async function resetStaffPassword(id: string, password?: string) {
  return run((actor) => resetStaffPasswordAs(actor, id, password || undefined));
}

export async function signOutStaff(id: string) {
  return run((actor) => signOutStaffAs(actor, id));
}

export async function setStaffDisabled(id: string, disabled: boolean) {
  return run((actor) => setStaffDisabledAs(actor, id, disabled));
}

export async function deleteStaff(id: string) {
  return run((actor) => deleteStaffAs(actor, id));
}
