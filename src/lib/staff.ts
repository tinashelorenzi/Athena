import { prisma } from "@/lib/db";
import { generatePassword, hashPassword } from "@/lib/password";
import { audit } from "@/lib/labs/manage";

/**
 * Instructor (SUPER_ADMIN) accounts, managed by architects on the Staff page
 * (/admin/staff). Every change runs as `actorId` (an architect; callers check)
 * and is audited (STAFF_* rows in lab_audit_events). Guards: you can't
 * deactivate, delete or remove the architect permission from yourself, and
 * Athena always keeps at least one active architect.
 */

export type StaffResult<T = object> = ({ ok: true } & T) | { ok?: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 10;

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  isArchitect: boolean;
  disabledAt: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  activeSessions: number;
  mcpKeys: number;
};

export async function listStaff(): Promise<StaffRow[]> {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN" },
    orderBy: [{ disabledAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: {
      id: true, name: true, email: true, isArchitect: true, disabledAt: true, createdAt: true,
      sessions: { select: { createdAt: true, expiresAt: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { apiKeys: { where: { kind: "MCP", revokedAt: null } } } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isArchitect: u.isArchitect,
    disabledAt: u.disabledAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    lastSignInAt: u.sessions[0]?.createdAt.toISOString() ?? null,
    activeSessions: u.sessions.filter((s) => s.expiresAt > now).length,
    mcpKeys: u._count.apiKeys,
  }));
}

async function findStaff(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, isArchitect: true, disabledAt: true } });
  return u && u.role === "SUPER_ADMIN" ? u : null;
}

/** Other active architects besides `exceptId`: removing the last one would lock everyone out of staff and authoring. */
const otherArchitects = (exceptId: string) =>
  prisma.user.count({ where: { role: "SUPER_ADMIN", isArchitect: true, disabledAt: null, id: { not: exceptId } } });

function checkPassword(password: string | undefined): string | null {
  if (password && password.length < MIN_PASSWORD) return `The password must be at least ${MIN_PASSWORD} characters.`;
  return null;
}

/** Create an instructor. The password (given, or generated) is returned once. */
export async function createStaffAs(
  actorId: string,
  input: { name: string; email: string; password?: string; isArchitect?: boolean },
): Promise<StaffResult<{ id: string; name: string; email: string; password: string }>> {
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!name) return { error: "Name is required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  const bad = checkPassword(input.password);
  if (bad) return { error: bad };
  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing) {
    return { error: existing.role === "STUDENT" ? `${email} is a student's account. Use another email for the instructor account.` : `${email} is already an instructor.` };
  }
  const password = input.password || generatePassword();
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: "SUPER_ADMIN", isArchitect: Boolean(input.isArchitect) },
  });
  await audit("STAFF_CREATED", actorId, { staffId: user.id, email, isArchitect: user.isArchitect });
  return { ok: true, id: user.id, name, email, password };
}

/** Change an instructor's name, email or architect permission. */
export async function updateStaffAs(
  actorId: string,
  id: string,
  input: { name?: string; email?: string; isArchitect?: boolean },
): Promise<StaffResult<{ changed: string[] }>> {
  const u = await findStaff(id);
  if (!u) return { error: "No such instructor." };
  const data: { name?: string; email?: string; isArchitect?: boolean } = {};
  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) return { error: "Name is required." };
    if (name !== u.name) data.name = name;
  }
  if (input.email !== undefined) {
    const email = String(input.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
    if (email !== u.email) {
      if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return { error: `${email} is already used by another account.` };
      data.email = email;
    }
  }
  if (input.isArchitect !== undefined && Boolean(input.isArchitect) !== u.isArchitect) {
    if (!input.isArchitect) {
      if (id === actorId) return { error: "You can't remove your own architect permission. Ask another architect." };
      if (!u.disabledAt && !(await otherArchitects(id))) return { error: "Athena needs at least one active architect." };
    }
    data.isArchitect = Boolean(input.isArchitect);
  }
  const changed = Object.keys(data);
  if (!changed.length) return { ok: true, changed };
  await prisma.user.update({ where: { id }, data });
  await audit("STAFF_UPDATED", actorId, { staffId: id, changed, ...(data.isArchitect !== undefined ? { isArchitect: data.isArchitect } : {}) });
  return { ok: true, changed };
}

/**
 * Set a new password (given, or generated) and sign the instructor out
 * everywhere. Your own password is changed in Settings, which asks for the
 * current one.
 */
export async function resetStaffPasswordAs(actorId: string, id: string, password?: string): Promise<StaffResult<{ password: string; email: string }>> {
  if (id === actorId) return { error: "Change your own password in Settings → Account." };
  const u = await findStaff(id);
  if (!u) return { error: "No such instructor." };
  const bad = checkPassword(password);
  if (bad) return { error: bad };
  const next = password || generatePassword();
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(next) } }),
    prisma.session.deleteMany({ where: { userId: id } }),
  ]);
  await audit("STAFF_PASSWORD_RESET", actorId, { staffId: id });
  return { ok: true, password: next, email: u.email };
}

/** End all of an instructor's sessions (they sign in again). */
export async function signOutStaffAs(actorId: string, id: string): Promise<StaffResult<{ sessions: number }>> {
  if (id === actorId) return { error: "Use Sign out in your own menu." };
  const u = await findStaff(id);
  if (!u) return { error: "No such instructor." };
  const { count } = await prisma.session.deleteMany({ where: { userId: id } });
  await audit("STAFF_SIGNED_OUT", actorId, { staffId: id, sessions: count });
  return { ok: true, sessions: count };
}

/**
 * Deactivate (or reactivate) an instructor. Deactivated, they can't sign in,
 * their sessions end, and their MCP keys and upload links stop working; their
 * scenarios, grades and history stay.
 */
export async function setStaffDisabledAs(actorId: string, id: string, disabled: boolean): Promise<StaffResult> {
  if (id === actorId) return { error: "You can't deactivate your own account." };
  const u = await findStaff(id);
  if (!u) return { error: "No such instructor." };
  if (disabled === Boolean(u.disabledAt)) return { ok: true };
  if (disabled && u.isArchitect && !(await otherArchitects(id))) return { error: "Athena needs at least one active architect." };
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { disabledAt: disabled ? new Date() : null } }),
    ...(disabled ? [prisma.session.deleteMany({ where: { userId: id } })] : []),
  ]);
  await audit(disabled ? "STAFF_DEACTIVATED" : "STAFF_REACTIVATED", actorId, { staffId: id });
  return { ok: true };
}

/**
 * Delete an instructor's account for good: their sessions, MCP keys and
 * machines go with it. Scenarios, cohorts and grades they made stay.
 * Deactivating is the reversible option.
 */
export async function deleteStaffAs(actorId: string, id: string): Promise<StaffResult> {
  if (id === actorId) return { error: "You can't delete your own account." };
  const u = await findStaff(id);
  if (!u) return { error: "No such instructor." };
  if (u.isArchitect && !u.disabledAt && !(await otherArchitects(id))) return { error: "Athena needs at least one active architect." };
  await prisma.user.delete({ where: { id } });
  await audit("STAFF_DELETED", actorId, { staffId: id, email: u.email, name: u.name });
  return { ok: true };
}
