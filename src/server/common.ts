import { db } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { AppError, ensure } from '@/lib/domain';
import type { Context } from './context';
export type Tx = Prisma.TransactionClient;
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
  throw new AppError('La operación está ocupada. Intenta de nuevo.', 409);
}
export async function audit(
  tx: Tx,
  c: Context,
  action: string,
  entityId: string,
  details: Prisma.InputJsonValue = {},
) {
  await tx.auditLog.create({
    data: { tenantId: c.tenantId, actorId: c.userId, action, entityId, details },
  });
}
export async function memberFor(tx: Tx, c: Context, id: string) {
  const member = await tx.member.findFirst({ where: { id, tenantId: c.tenantId } });
  ensure(member, 'Cliente no encontrado.', 404);
  if (c.role === 'CLIENT')
    ensure(member.userId === c.userId, 'Solo puedes consultar tu información.', 403);
  if (c.role === 'TRAINER')
    ensure(member.trainerId === c.userId, 'Este cliente no está asignado a ti.', 403);
  return member;
}
export async function openShift(tx: Tx, c: Context) {
  const shift = await tx.shift.findFirst({
    where: { tenantId: c.tenantId, userId: c.userId, closedAt: null },
    include: { sales: true, refunds: true, movements: true },
  });
  ensure(shift, 'Abre tu turno de caja antes de registrar esta operación.');
  return shift;
}
