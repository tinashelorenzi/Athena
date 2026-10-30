"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireArchitect, requireRole } from "@/lib/auth";
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
  await prisma.apiKey.deleteMany({ where: { id, kind: "INTEGRATION" } });
  revalidatePath("/admin/settings");
  return {};
}

/**
 * Generate a personal MCP key for the signed-in architect (docs/mcp.md). It
 * acts as them on /api/mcp; the raw key is returned once and never stored.
 */
export async function createMcpKey(name: string): Promise<CreateApiKeyState> {
  const architect = await requireArchitect();

  name = String(name ?? "").trim().slice(0, 80);
  if (!name) return { error: "Give the key a name (e.g. \"Claude Code on my laptop\")." };

  const { raw, prefix, keyHash } = newApiKeyMaterial("MCP");
  await prisma.apiKey.create({
    data: { kind: "MCP", name, prefix, keyHash, createdById: architect.id, userId: architect.id },
  });

  revalidatePath("/admin/settings");
  return { created: { name, key: raw } };
}

/** Revoke one of your own MCP keys. */
export async function revokeMcpKey(id: string): Promise<{ error?: string }> {
  const architect = await requireArchitect();
  await prisma.apiKey.deleteMany({ where: { id, kind: "MCP", userId: architect.id } });
  revalidatePath("/admin/settings");
  return {};
}
