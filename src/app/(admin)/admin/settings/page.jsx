import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { requireRole } from '@/lib/auth';
import { getSecuritySettings, getMailSettings, getStorageSettings } from '@/lib/settings';
import { getBaseUrl } from '@/lib/url';
import { prisma } from '@/lib/db';

const keyRow = (k) => ({
  id: k.id,
  name: k.name,
  prefix: k.prefix,
  created: k.createdAt.toISOString().slice(0, 10),
  lastUsed: k.lastUsedAt ? k.lastUsedAt.toISOString().slice(0, 10) : 'Never',
});

/* Instructor settings — Account, Security (Turnstile + sessions), Mail (SMTP),
   API Access, and (architects only) MCP. Secret values are never sent to the
   client (masked/omitted). */
export default async function SettingsPage() {
  const user = await requireRole('SUPER_ADMIN');
  const select = { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true };

  const [security, mail, storage, keys, mcpKeys, baseUrl] = await Promise.all([
    getSecuritySettings(),
    getMailSettings(),
    getStorageSettings(),
    prisma.apiKey.findMany({ where: { revokedAt: null, kind: 'INTEGRATION' }, orderBy: { createdAt: 'desc' }, select }),
    user.isArchitect
      ? prisma.apiKey.findMany({ where: { revokedAt: null, kind: 'MCP', userId: user.id }, orderBy: { createdAt: 'desc' }, select })
      : [],
    getBaseUrl(),
  ]);

  return (
    <SettingsScreen
      user={{ name: user.name, email: user.email, role: user.role }}
      security={security}
      mail={mail}
      storage={storage}
      apiKeys={keys.map(keyRow)}
      mcp={user.isArchitect ? { keys: mcpKeys.map(keyRow), url: `${baseUrl}/api/mcp` } : null}
    />
  );
}
