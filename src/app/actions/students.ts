"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { hashPassword, generatePassword } from "@/lib/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The auto-password for a bulk-created account: the email with a capital first
 *  letter (e.g. "ada@zaio.io" → "Ada@zaio.io"). Students change it on first login. */
function emailPassword(email: string): string {
  const e = email.trim();
  return e.charAt(0).toUpperCase() + e.slice(1);
}

/** A friendly placeholder name from an email local-part ("ada.lovelace" → "Ada Lovelace"). */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] || email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ") || email;
}

export type BulkCreateState = {
  error?: string;
  ok?: string;
  created?: { email: string; password: string }[];
  skipped?: string[];
};

/**
 * Bulk-create STUDENT accounts from a pasted list of emails. Each gets an
 * email-derived password (capitalised first letter) and is flagged to set their
 * name (+ optional password) on first login. Existing emails are skipped.
 */
export async function bulkCreateStudents(
  _prevState: BulkCreateState,
  formData: FormData,
): Promise<BulkCreateState> {
  const admin = await requireRole("SUPER_ADMIN");

  const emails = [
    ...new Set(
      String(formData.get("emails") ?? "")
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (emails.length === 0) return { error: "Paste at least one email address." };
  if (emails.length > 500) return { error: "Too many at once — please do 500 or fewer." };

  // Resolve cohort: a new name takes precedence, else an existing id.
  const newCohortName = String(formData.get("newCohortName") ?? "").trim();
  let cohortId: string | null = String(formData.get("cohortId") ?? "") || null;
  if (newCohortName) {
    const cohort = await prisma.cohort.upsert({
      where: { name: newCohortName },
      update: {},
      create: { name: newCohortName, createdById: admin.id },
    });
    cohortId = cohort.id;
  }

  const created: { email: string; password: string }[] = [];
  const skipped: string[] = [];

  for (const email of emails) {
    if (!EMAIL_RE.test(email)) { skipped.push(email); continue; }
    if (await prisma.user.findUnique({ where: { email } })) { skipped.push(email); continue; }

    const password = emailPassword(email);
    try {
      await prisma.user.create({
        data: {
          email,
          name: nameFromEmail(email),
          passwordHash: await hashPassword(password),
          role: "STUDENT",
          cohortId,
          mustSetName: true,
        },
      });
      created.push({ email, password });
    } catch {
      skipped.push(email);
    }
  }

  revalidatePath("/admin/students");
  if (cohortId) revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath("/admin/cohorts");

  const parts = [`Created ${created.length} account${created.length === 1 ? "" : "s"}`];
  if (skipped.length) parts.push(`skipped ${skipped.length} (invalid or already exist)`);
  return { ok: parts.join(" · "), created, skipped };
}

export type CreateStudentState = {
  error?: string;
  created?: { name: string; email: string; password: string };
  linked?: { name: string; email: string };
};

/**
 * Create a STUDENT account (instructor-only). The password is generated and
 * returned once so the instructor can hand it to the student; it is never
 * stored in plaintext.
 */
export async function createStudent(
  _prevState: CreateStudentState,
  formData: FormData,
): Promise<CreateStudentState> {
  const admin = await requireRole("SUPER_ADMIN");

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!name) return { error: "Name is required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  // Optional cohort: a new name takes precedence, else an existing id.
  const newCohortName = String(formData.get("newCohortName") ?? "").trim();
  let cohortId: string | null = String(formData.get("cohortId") ?? "") || null;
  if (newCohortName) {
    const cohort = await prisma.cohort.upsert({
      where: { name: newCohortName },
      update: {},
      create: { name: newCohortName, createdById: admin.id },
    });
    cohortId = cohort.id;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "STUDENT") {
      return { error: `An account already exists for ${email}.` };
    }
    if (!cohortId) {
      return {
        error: `An account already exists for ${email}. Open a cohort → Add students to link them.`,
      };
    }
    if (existing.cohortId === cohortId) {
      return { error: `${email} is already in this cohort.` };
    }

    const linked = await prisma.user.update({
      where: { id: existing.id },
      data: {
        cohortId,
        name: name || existing.name,
      },
    });

    revalidatePath("/admin/students");
    revalidatePath(`/admin/cohorts/${cohortId}`);
    revalidatePath("/admin/cohorts");
    if (existing.cohortId) revalidatePath(`/admin/cohorts/${existing.cohortId}`);
    return { linked: { name: linked.name, email: linked.email } };
  }

  // Use the instructor-provided password if given (e.g. the "Generate" button
  // filled it, or they typed one); otherwise generate a strong one.
  const provided = String(formData.get("password") ?? "");
  if (provided && provided.length < 10) {
    return { error: "Password must be at least 10 characters." };
  }
  const password = provided || generatePassword();

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: "STUDENT",
      cohortId,
    },
  });

  revalidatePath("/admin/students");
  if (cohortId) revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath("/admin/cohorts");
  return { created: { name, email, password } };
}

export type MutateStudentResult = { error?: string; password?: string };

/** Reset a student's password to a new generated one; returns it once. */
export async function resetStudentPassword(
  studentId: string,
): Promise<MutateStudentResult> {
  await requireRole("SUPER_ADMIN");

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT") {
    return { error: "Student not found." };
  }

  const password = generatePassword();
  await prisma.user.update({
    where: { id: studentId },
    data: { passwordHash: await hashPassword(password) },
  });

  revalidatePath("/admin/students");
  return { password };
}

/** Delete a student account. Guards against deleting non-student accounts. */
export async function deleteStudent(
  studentId: string,
): Promise<MutateStudentResult> {
  await requireRole("SUPER_ADMIN");

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT") {
    return { error: "Student not found." };
  }

  await prisma.user.delete({ where: { id: studentId } });
  revalidatePath("/admin/students");
  return {};
}
