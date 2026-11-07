import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Dashboard } from '@/components/dashboard';
export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  return <Dashboard user={{ name: session.user.name, email: session.user.email }} />;
}
