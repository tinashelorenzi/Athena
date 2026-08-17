import { prisma } from "@/lib/db";
import { unusablePasswordHash } from "@/lib/zaio-sso";

export type ProvisionCohortInput = {
  name: string;
  zaioBootcampId: string;
  createdById: string;
};

export type ProvisionCohortResult =
  | { ok: true; cohort: { id: string; name: string; created: boolean } }
  | { ok: false; error: string };

/** Create (or return) an Athena cohort for a Zaio bootcamp. Idempotent on zaioBootcampId. */
export async function provisionCohortForBootcamp(
  input: ProvisionCohortInput,
): Promise<ProvisionCohortResult> {
  const name = input.name.trim();
  const zaioBootcampId = input.zaioBootcampId.trim();
  if (!name) return { ok: false, error: "Cohort name is required." };
  if (!zaioBootcampId) return { ok: false, error: "zaioBootcampId is required." };

  const existing = await prisma.cohort.findUnique({ where: { zaioBootcampId } });
  if (existing) {
    return { ok: true, cohort: { id: existing.id, name: existing.name, created: false } };
  }

  const nameTaken = await prisma.cohort.findUnique({ where: { name } });
  if (nameTaken) {
    return { ok: false, error: `A cohort named "${name}" already exists.` };
  }

  const cohort = await prisma.cohort.create({
    data: {
      name,
      zaioBootcampId,
      createdById: input.createdById,
    },
  });
  return { ok: true, cohort: { id: cohort.id, name: cohort.name, created: true } };
}

export type AddStudentInput = {
  cohortId: string;
  email: string;
  name?: string | null;
  zaioUserId?: string | null;
  studentNumber?: string | null;
};

export type AddStudentResult =
  | { ok: true; user: { id: string; email: string; created: boolean } }
  | { ok: false; error: string };

/** Add or link a Zaio student to an Athena cohort (SSO-compatible account). */
export async function addStudentToCohort(input: AddStudentInput): Promise<AddStudentResult> {
  const email = input.email.trim().toLowerCase();
  const name = (input.name || email).trim();
  const zaioUserId = input.zaioUserId?.trim() || null;
  const studentNumber = input.studentNumber?.trim() || null;

  if (!email) return { ok: false, error: "email is required." };

  const cohort = await prisma.cohort.findUnique({ where: { id: input.cohortId } });
  if (!cohort) return { ok: false, error: "Cohort not found." };

  let user =
    (await prisma.user.findFirst({
      where: {
        OR: [
          ...(zaioUserId ? [{ zaioUserId }] : []),
          { email },
          ...(studentNumber ? [{ studentNumber }] : []),
        ],
      },
    })) ?? null;

  let created = false;
  if (user) {
    if (user.role !== "STUDENT") {
      return { ok: false, error: `An account already exists for ${email} but is not a student.` };
    }
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        cohortId: cohort.id,
        name: user.name || name,
        zaioUserId: user.zaioUserId ?? zaioUserId,
        ...(studentNumber ? { studentNumber } : {}),
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email,
        name,
        zaioUserId,
        studentNumber,
        role: "STUDENT",
        cohortId: cohort.id,
        passwordHash: await unusablePasswordHash(),
      },
    });
    created = true;
  }

  return { ok: true, user: { id: user.id, email: user.email, created } };
}

export type BindScenariosInput = {
  cohortId: string;
  refTokens?: string[];
  scenarioIds?: string[];
  boundById: string;
};

export type BindScenariosResult =
  | { ok: true; bound: number; scenarioIds: string[] }
  | { ok: false; error: string };

/** Bind authored scenarios to a cohort by refToken and/or scenario id (idempotent). */
export async function bindScenariosToCohort(input: BindScenariosInput): Promise<BindScenariosResult> {
  const cohort = await prisma.cohort.findUnique({ where: { id: input.cohortId } });
  if (!cohort) return { ok: false, error: "Cohort not found." };

  const refTokens = (input.refTokens ?? []).map((t) => t.trim()).filter(Boolean);
  const scenarioIds = [...(input.scenarioIds ?? [])];

  if (refTokens.length) {
    const fromRefs = await prisma.scenario.findMany({
      where: { refToken: { in: refTokens } },
      select: { id: true },
    });
    scenarioIds.push(...fromRefs.map((s) => s.id));
  }

  const uniqueIds = [...new Set(scenarioIds)];
  if (!uniqueIds.length) return { ok: false, error: "No scenarios to bind." };

  const found = await prisma.scenario.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (!found.length) return { ok: false, error: "No valid scenarios found." };

  const result = await prisma.cohortScenario.createMany({
    data: found.map((s) => ({
      cohortId: input.cohortId,
      scenarioId: s.id,
      boundById: input.boundById,
    })),
    skipDuplicates: true,
  });

  return { ok: true, bound: result.count, scenarioIds: found.map((s) => s.id) };
}
