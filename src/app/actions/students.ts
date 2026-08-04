"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { hashPassword, generatePassword } from "@/lib/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateStudentState = {
  error?: string;
  created?: { name: string; email: string; password: string };
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: `An account already exists for ${email}.` };

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

  const password = generatePassword();
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
