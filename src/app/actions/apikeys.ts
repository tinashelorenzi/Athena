"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { newApiKeyMaterial } from "@/lib/apikeys";

export type CreateApiKeyState = {
  error?: string;
  created?: { name: string; key: string };
};

/** Generate a new API key. The raw key is returned once and never stored. */
export async function createApiKey(
  _prevState: CreateApiKeyState,
  formData: FormData,
): Promise<CreateApiKeyState> {
  const admin = await requireRole("SUPER_ADMIN");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the key a name (e.g. the app that will use it)." };

  const { raw, prefix, keyHash } = newApiKeyMaterial();
  await prisma.apiKey.create({
    data: { name, prefix, keyHash, createdById: admin.id },
  });

  revalidatePath("/admin/settings");
  return { created: { name, key: raw } };
}

/** Revoke (delete) an API key so it can no longer authenticate. */
export async function revokeApiKey(id: string): Promise<{ error?: string }> {
  await requireRole("SUPER_ADMIN");
  await prisma.apiKey.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/settings");
  return {};
}
