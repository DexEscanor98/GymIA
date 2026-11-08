import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { PersonalDashboard } from '@/components/personal-dashboard';
import { billingCheckoutIsConfigured } from '@/server/legal-acceptance';
export default async function PersonalPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  return (
    <PersonalDashboard
      user={{ name: session.user.name, email: session.user.email }}
      legalCheckoutReady={billingCheckoutIsConfigured()}
    />
  );
}
