import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { requireRole } from '@/lib/auth';
import { getSecuritySettings, getMailSettings, getStorageSettings } from '@/lib/settings';
import { prisma } from '@/lib/db';

/* Instructor settings — Account, Security (Turnstile + sessions), Mail (SMTP),
   API Access. Secret values are never sent to the client (masked/omitted). */
export default async function SettingsPage() {
  const user = await requireRole('SUPER_ADMIN');

  const [security, mail, storage, keys] = await Promise.all([
    getSecuritySettings(),
    getMailSettings(),
    getStorageSettings(),
    prisma.apiKey.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
    }),
  ]);

  const apiKeys = keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    created: k.createdAt.toISOString().slice(0, 10),
    lastUsed: k.lastUsedAt ? k.lastUsedAt.toISOString().slice(0, 10) : 'Never',
  }));

  return (
    <SettingsScreen
      user={{ name: user.name, email: user.email, role: user.role }}
      security={security}
      mail={mail}
      storage={storage}
      apiKeys={apiKeys}
    />
  );
}
