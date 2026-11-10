import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ContactVerificationForm } from '@/components/contact-verification-form';

export default async function VerifyAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    const { email = '' } = await searchParams;
    return <ContactVerificationForm email={email} />;
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true, phoneNumber: true, phoneNumberVerified: true },
  });
  if (!user) return <ContactVerificationForm email={session.user.email} />;
  const ownedTenants = await db.access.findMany({
    where: { userId: session.user.id, active: true, role: 'OWNER' },
    select: { tenantId: true, tenant: { select: { name: true } } },
  });
  const gymSubscriptions = await db.saasSubscription.findMany({
    where: {
      tenantId: { in: ownedTenants.map((item) => item.tenantId) },
      status: { in: ['ACTIVE', 'PAST_DUE', 'PENDING'] },
      mpPreapprovalId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  });
  const profile = await db.athleteProfile.findUnique({ where: { userId: session.user.id } });
  const personalSubscription = profile
    ? await db.athleteSubscription.findFirst({
        where: {
          profileId: profile.id,
          status: { in: ['ACTIVE', 'PAST_DUE'] },
          mpPreapprovalId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      })
    : null;
  return (
    <ContactVerificationForm
      email={user.email}
      emailVerified={user.emailVerified}
      canSkip
      phoneNumber={user.phoneNumber ?? ''}
      phoneVerified={user.phoneNumberVerified}
      gymSubscriptions={gymSubscriptions.map((subscription) => ({
        tenantId: subscription.tenantId,
        gymName:
          ownedTenants.find((tenant) => tenant.tenantId === subscription.tenantId)?.tenant.name ??
          'Gimnasio',
      }))}
      personalSubscriptionActive={Boolean(personalSubscription)}
    />
  );
}
