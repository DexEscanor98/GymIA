import { AuthForm } from '@/components/auth-form';
export default async function Page({ searchParams }: { searchParams: Promise<{ gym?: string }> }) {
  const { gym } = await searchParams;
  return <AuthForm register gymOwner={gym === '1'} />;
}
