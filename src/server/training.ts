import { z } from 'zod';
import { allow, ensure, localDay, membershipState } from '@/lib/domain';
import { transaction, audit, memberFor } from './common';
import type { Context } from './context';
export async function training(c: Context, action: string, input: unknown) {
  return transaction(async (tx) => {
    if (action === 'appointment.create') {
      const d = z
        .object({ memberId: z.string(), startsAt: z.iso.datetime(), walkIn: z.boolean() })
        .parse(input);
      if (d.walkIn) allow(c.role, ['OWNER', 'RECEPTION', 'TRAINER']);
      const member = await memberFor(tx, c, d.memberId);
      ensure(member.trainerId, 'Primero asigna un entrenador al cliente.');
      ensure(
        await tx.access.findFirst({
          where: { tenantId: c.tenantId, userId: member.trainerId, role: 'TRAINER', active: true },
        }),
        'El entrenador no está disponible.',
      );
      const start = d.walkIn ? new Date() : new Date(d.startsAt),
        end = new Date(start.getTime() + 3600000),
        serviceDay = localDay(start, c.timezone);
      ensure(!Number.isNaN(start.getTime()), 'Fecha de sesión inválida.');
      ensure(
        d.walkIn || start.getTime() >= Date.now() - 60_000,
        'No se puede reservar en el pasado.',
      );
      ensure(
        d.walkIn || start.getTime() <= Date.now() + 180 * 24 * 60 * 60 * 1000,
        'Agenda la sesión dentro de los próximos 180 días.',
      );
      const memberships = await tx.membership.findMany({
        where: { tenantId: c.tenantId, memberId: member.id, personalTraining: true },
      });
      ensure(
        memberships.some((m) => membershipState(m, start) === 'Activa'),
        'No hay asesoría pagada y vigente para esa fecha.',
      );
      ensure(
        !(await tx.appointment.findFirst({
          where: {
            tenantId: c.tenantId,
            memberId: member.id,
            serviceDay,
            status: { not: 'CANCELLED' },
          },
        })),
        'Ya hay una sesión reservada o realizada ese día.',
      );
      ensure(
        !(await tx.appointment.findFirst({
          where: {
            tenantId: c.tenantId,
            trainerId: member.trainerId,
            status: { not: 'CANCELLED' },
            startsAt: { lt: end },
            endsAt: { gt: start },
          },
        })),
        'El entrenador tiene otra sesión a esa hora.',
      );
      const result = await tx.appointment.create({
        data: {
          tenantId: c.tenantId,
          memberId: member.id,
          trainerId: member.trainerId,
          startsAt: start,
          endsAt: end,
          serviceDay,
          status: d.walkIn ? 'COMPLETED' : 'BOOKED',
          completedAt: d.walkIn ? new Date() : null,
        },
      });
      await audit(tx, c, action, result.id, { walkIn: d.walkIn });
      return result;
    }
    const d = z
      .object({
        id: z.string(),
        rating: z.number().int().min(1).max(5).optional(),
        comment: z.string().trim().max(1000).optional(),
      })
      .parse(input);
    const appointment = await tx.appointment.findFirst({
      where: { id: d.id, tenantId: c.tenantId },
    });
    ensure(appointment, 'Sesión no encontrada.', 404);
    await memberFor(tx, c, appointment.memberId);
    if (c.role === 'TRAINER')
      ensure(appointment.trainerId === c.userId, 'La sesión pertenece a otro entrenador.', 403);
    if (action === 'appointment.rate') {
      allow(c.role, ['CLIENT']);
      ensure(appointment.status === 'COMPLETED', 'Solo puedes calificar sesiones realizadas.');
      ensure(d.rating, 'Selecciona de 1 a 5 estrellas.');
      const result = await tx.appointment.update({
        where: { id: d.id },
        data: { rating: d.rating, comment: d.comment },
      });
      await audit(tx, c, action, d.id, { rating: d.rating });
      return result;
    }
    if (action === 'appointment.complete') {
      allow(c.role, ['OWNER', 'RECEPTION', 'TRAINER']);
      ensure(appointment.status === 'BOOKED', 'La sesión ya fue registrada o cancelada.');
      ensure(
        appointment.serviceDay === localDay(new Date(), c.timezone),
        'Registra la sesión el día de la cita.',
      );
      const memberships = await tx.membership.findMany({
        where: { tenantId: c.tenantId, memberId: appointment.memberId, personalTraining: true },
      });
      ensure(
        memberships.some((m) => membershipState(m) === 'Activa'),
        'La asesoría no está vigente o está congelada.',
      );
      const result = await tx.appointment.update({
        where: { id: d.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await audit(tx, c, action, d.id);
      return result;
    }
    if (action === 'appointment.cancel') {
      ensure(appointment.status === 'BOOKED', 'Solo puedes cancelar una reserva pendiente.');
      const result = await tx.appointment.update({
        where: { id: d.id },
        data: { status: 'CANCELLED' },
      });
      await audit(tx, c, action, d.id);
      return result;
    }
    throw new Error('Operación de asesoría desconocida');
  });
}
