import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Dashboard } from '@/components/dashboard';
import { PersonalDashboard } from '@/components/personal-dashboard';
import { db } from '@/lib/db';
import { billingCheckoutIsConfigured } from '@/server/legal-acceptance';
export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const access = await db.access.findFirst({
    where: { userId: session.user.id, active: true },
    select: { id: true },
  });
  if (!access)
    return (
      <PersonalDashboard
        user={{ name: session.user.name, email: session.user.email }}
        legalCheckoutReady={billingCheckoutIsConfigured()}
      />
    );
  return (
    <Dashboard
      user={{ name: session.user.name, email: session.user.email }}
      legalCheckoutReady={billingCheckoutIsConfigured()}
    />
  );
}
