import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensure, type Role } from '@/lib/domain';
import { requireVerifiedContacts } from './verified-contacts';
export type Context = { tenantId: string; userId: string; role: Role; timezone: string };
export async function context(
  tenantId?: string | null,
  options: { requireVerifiedContacts?: boolean } = {},
): Promise<Context> {
  const session = await auth.api.getSession({ headers: await headers() });
  ensure(session, 'Inicia sesión para continuar.', 401);
  if (options.requireVerifiedContacts !== false) await requireVerifiedContacts(session.user.id);
  const access = await db.access.findFirst({
    where: { userId: session.user.id, active: true, ...(tenantId ? { tenantId } : {}) },
    include: { tenant: true },
    orderBy: { id: 'asc' },
  });
  ensure(access, 'Crea tu gimnasio o pide al dueño que vincule tu cuenta.', 403);
  return {
    tenantId: access.tenantId,
    userId: session.user.id,
    role: access.role,
    timezone: access.tenant.timezone,
  };
}
