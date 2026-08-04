import { prisma } from '@/lib/db';
import { hashInviteToken } from '@/lib/invitations';
import { acceptInvitation } from '@/app/actions/invitations';
import { AcceptInviteScreen } from '@/components/screens/AcceptInviteScreen';

/* Public invitation-acceptance page. The student sets a name + password and the
   STUDENT account is created (in the invitation's cohort). */
export default async function InvitePage({ params }) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { cohort: { select: { name: true } } },
  });

  const valid = Boolean(invitation && !invitation.acceptedAt && invitation.expiresAt.getTime() >= Date.now());

  return (
    <AcceptInviteScreen
      valid={valid}
      email={valid ? invitation.email : null}
      cohortName={valid ? invitation.cohort?.name ?? null : null}
      action={acceptInvitation.bind(null, token)}
    />
  );
}
