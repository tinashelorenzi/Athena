import { prisma } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

/**
 * Platform settings access layer (server-only). Reads/writes the `Setting`
 * key/value store. Secret values are encrypted at rest; the public getters
 * return only a "configured" flag, never the secret itself. The `*Internal`
 * getters decrypt secrets and are for server-side use only (Turnstile verify,
 * SMTP send) — never pass their result to a Client Component.
 */
const K = {
  turnstileEnabled: "security.turnstile.enabled",
  turnstileSiteKey: "security.turnstile.siteKey",
  turnstileSecretKey: "security.turnstile.secretKey",
  sessionLifetimeDays: "security.session.lifetimeDays",
  mailHost: "mail.smtp.host",
  mailPort: "mail.smtp.port",
  mailSecure: "mail.smtp.secure",
  mailUser: "mail.smtp.user",
  mailPassword: "mail.smtp.password",
  mailFromName: "mail.from.name",
  mailFromAddress: "mail.from.address",
  storageProvider: "storage.provider",
  storageEndpoint: "storage.endpoint",
  storageRegion: "storage.region",
  storageBucket: "storage.bucket",
  storageAccessKeyId: "storage.accessKeyId",
  storageSecretAccessKey: "storage.secretAccessKey",
  storageForcePathStyle: "storage.forcePathStyle",
} as const;

const DEFAULT_SESSION_DAYS = 7;

async function getMap(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Upsert a batch; keys with `undefined` value are skipped (leave existing). */
async function setMany(entries: Record<string, string | undefined>): Promise<void> {
  const ops = Object.entries(entries)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: value as string },
        create: { key, value: value as string },
      }),
    );
  if (ops.length) await prisma.$transaction(ops);
}

function safeDecrypt(value: string | undefined): string {
  if (!value) return "";
  try {
    return decryptSecret(value);
  } catch {
    return "";
  }
}

// ── Security ──────────────────────────────────────────────────────────────
export type SecuritySettings = {
  turnstileEnabled: boolean;
  turnstileSiteKey: string;
  turnstileSecretConfigured: boolean;
  sessionLifetimeDays: number;
};

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const m = await getMap([K.turnstileEnabled, K.turnstileSiteKey, K.turnstileSecretKey, K.sessionLifetimeDays]);
  return {
    turnstileEnabled: m[K.turnstileEnabled] === "true",
    turnstileSiteKey: m[K.turnstileSiteKey] ?? "",
    turnstileSecretConfigured: Boolean(m[K.turnstileSecretKey]),
    sessionLifetimeDays: Number(m[K.sessionLifetimeDays]) || DEFAULT_SESSION_DAYS,
  };
}

/** Public Turnstile config for the login page (enabled + site key only). */
export async function getTurnstilePublic(): Promise<{ enabled: boolean; siteKey: string }> {
  const m = await getMap([K.turnstileEnabled, K.turnstileSiteKey, K.turnstileSecretKey]);
  const enabled = m[K.turnstileEnabled] === "true" && Boolean(m[K.turnstileSiteKey]) && Boolean(m[K.turnstileSecretKey]);
  return { enabled, siteKey: m[K.turnstileSiteKey] ?? "" };
}

/** Decrypted Turnstile secret for server-side verification. */
export async function getTurnstileSecret(): Promise<string> {
  const m = await getMap([K.turnstileSecretKey]);
  return safeDecrypt(m[K.turnstileSecretKey]);
}

export async function saveSecuritySettings(input: {
  turnstileEnabled: boolean;
  turnstileSiteKey: string;
  turnstileSecretKey?: string; // undefined/empty = keep existing
  sessionLifetimeDays: number;
}): Promise<void> {
  await setMany({
    [K.turnstileEnabled]: input.turnstileEnabled ? "true" : "false",
    [K.turnstileSiteKey]: input.turnstileSiteKey,
    [K.turnstileSecretKey]: input.turnstileSecretKey ? encryptSecret(input.turnstileSecretKey) : undefined,
    [K.sessionLifetimeDays]: String(input.sessionLifetimeDays),
  });
}

export async function getSessionLifetimeMs(): Promise<number> {
  const m = await getMap([K.sessionLifetimeDays]);
  const days = Number(m[K.sessionLifetimeDays]) || DEFAULT_SESSION_DAYS;
  return days * 24 * 60 * 60 * 1000;
}

// ── Mail ──────────────────────────────────────────────────────────────────
export type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  passwordConfigured: boolean;
  fromName: string;
  fromAddress: string;
};

export async function getMailSettings(): Promise<MailSettings> {
  const m = await getMap([K.mailHost, K.mailPort, K.mailSecure, K.mailUser, K.mailPassword, K.mailFromName, K.mailFromAddress]);
  return {
    host: m[K.mailHost] ?? "",
    port: Number(m[K.mailPort]) || 587,
    secure: m[K.mailSecure] === "true",
    user: m[K.mailUser] ?? "",
    passwordConfigured: Boolean(m[K.mailPassword]),
    fromName: m[K.mailFromName] ?? "",
    fromAddress: m[K.mailFromAddress] ?? "",
  };
}

export type MailTransportConfig = MailSettings & { password: string };

/** Full mail config incl. decrypted password — server-side send/verify only. */
export async function getMailSettingsInternal(): Promise<MailTransportConfig> {
  const base = await getMailSettings();
  const m = await getMap([K.mailPassword]);
  return { ...base, password: safeDecrypt(m[K.mailPassword]) };
}

export async function saveMailSettings(input: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string; // undefined/empty = keep existing
  fromName: string;
  fromAddress: string;
}): Promise<void> {
  await setMany({
    [K.mailHost]: input.host,
    [K.mailPort]: String(input.port),
    [K.mailSecure]: input.secure ? "true" : "false",
    [K.mailUser]: input.user,
    [K.mailPassword]: input.password ? encryptSecret(input.password) : undefined,
    [K.mailFromName]: input.fromName,
    [K.mailFromAddress]: input.fromAddress,
  });
}

// ── Storage (S3 / MinIO) ────────────────────────────────────────────────────
export type StorageProvider = "s3" | "minio";

export type StorageSettings = {
  provider: StorageProvider;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretConfigured: boolean;
  forcePathStyle: boolean;
};

export async function getStorageSettings(): Promise<StorageSettings> {
  const m = await getMap([
    K.storageProvider, K.storageEndpoint, K.storageRegion, K.storageBucket,
    K.storageAccessKeyId, K.storageSecretAccessKey, K.storageForcePathStyle,
  ]);
  const provider = (m[K.storageProvider] === "minio" ? "minio" : "s3") as StorageProvider;
  return {
    provider,
    endpoint: m[K.storageEndpoint] ?? "",
    region: m[K.storageRegion] ?? "us-east-1",
    bucket: m[K.storageBucket] ?? "",
    accessKeyId: m[K.storageAccessKeyId] ?? "",
    secretConfigured: Boolean(m[K.storageSecretAccessKey]),
    forcePathStyle: m[K.storageForcePathStyle] === "true" || provider === "minio",
  };
}

export type StorageConfig = Omit<StorageSettings, "secretConfigured"> & { secretAccessKey: string };

/** Full storage config incl. decrypted secret — server-side S3 client only. */
export async function getStorageConfigInternal(): Promise<StorageConfig> {
  const base = await getStorageSettings();
  const m = await getMap([K.storageSecretAccessKey]);
  const { secretConfigured: _drop, ...rest } = base;
  void _drop;
  return { ...rest, secretAccessKey: safeDecrypt(m[K.storageSecretAccessKey]) };
}

export async function isStorageConfigured(): Promise<boolean> {
  const s = await getStorageSettings();
  return Boolean(s.bucket && s.accessKeyId && s.secretConfigured);
}

export async function saveStorageSettings(input: {
  provider: StorageProvider;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey?: string; // undefined/empty = keep existing
  forcePathStyle: boolean;
}): Promise<void> {
  await setMany({
    [K.storageProvider]: input.provider,
    [K.storageEndpoint]: input.endpoint,
    [K.storageRegion]: input.region,
    [K.storageBucket]: input.bucket,
    [K.storageAccessKeyId]: input.accessKeyId,
    [K.storageSecretAccessKey]: input.secretAccessKey ? encryptSecret(input.secretAccessKey) : undefined,
    [K.storageForcePathStyle]: input.forcePathStyle ? "true" : "false",
  });
}
