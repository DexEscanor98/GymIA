import { z } from 'zod';
import { allow, ensure, freezeRemaining, membershipAllows } from '@/lib/domain';
import { transaction, audit, memberFor } from './common';
import type { Context } from './context';
import { provisionUser } from './accounts';
import { effectivePlan, planInfo } from '@/lib/saas-plans';
import { db } from '@/lib/db';
export async function members(c: Context, action: string, input: unknown) {
  if (action === 'member.save') {
    allow(c.role, ['OWNER', 'RECEPTION']);
    const d = z
      .object({
        id: z.string().optional(),
        name: z.string().trim().min(2).max(100),
        email: z.union([z.email(), z.literal('')]),
        phone: z.string().trim().max(25),
        preference: z.enum(['ANY', 'WOMAN', 'MAN']),
        password: z.string().min(12).max(100).optional().or(z.literal('')),
      })
      .parse(input);
    ensure(!d.password || d.email, 'Para crear una contraseña, escribe el correo del cliente.');
    if (!d.id) {
      const tenant = await db.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
      const memberLimit = planInfo(
        effectivePlan(tenant.saasPlan, tenant.subscriptionExpiresAt),
      ).maxMembers;
      if (memberLimit !== null)
        ensure(
          (await db.member.count({ where: { tenantId: c.tenantId } })) < memberLimit,
          `El plan Gratis permite hasta ${memberLimit} clientes. Cambia de plan para registrar más.`,
        );
    }
    let userId: string | undefined;
    if (!d.id && d.email && d.password) {
      const user = await provisionUser({ name: d.name, email: d.email, password: d.password });
      userId = user.id;
    }
    return transaction(async (tx) => {
      if (d.id) await memberFor(tx, c, d.id);
      else {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
        const memberLimit = planInfo(
          effectivePlan(tenant.saasPlan, tenant.subscriptionExpiresAt),
        ).maxMembers;
        if (memberLimit !== null) {
          ensure(
            (await tx.member.count({ where: { tenantId: c.tenantId } })) < memberLimit,
            `El plan Gratis permite hasta ${memberLimit} clientes. Cambia de plan para registrar más.`,
          );
        }
      }
      if (userId) {
        ensure(
          !(await tx.member.findFirst({ where: { tenantId: c.tenantId, userId } })),
          'La cuenta ya está vinculada a otro cliente.',
        );
        await tx.access.upsert({
          where: { tenantId_userId: { tenantId: c.tenantId, userId } },
          create: { tenantId: c.tenantId, userId, role: 'CLIENT' },
          update: { active: true },
        });
      }
      const { id, password: _password, ...fields } = d;
      const data = { ...fields, email: d.email || null, phone: d.phone || null, userId };
      const result = id
        ? await tx.member.update({ where: { id }, data: { ...data, userId: undefined } })
        : await tx.member.create({ data: { ...data, tenantId: c.tenantId } });
      await audit(tx, c, action, result.id, {
        name: d.name,
        accountCreated: Boolean(userId),
      });
      return result;
    });
  }
  return transaction(async (tx) => {
    if (action === 'member.save') {
      throw new Error('Operación de clientes desconocida');
    }
    if (action === 'member.link') {
      allow(c.role, ['OWNER', 'RECEPTION']);
      const d = z
        .object({
          id: z.string().optional(),
          publicId: z
            .string()
            .trim()
            .regex(/^GYM-[A-F0-9]{20}$/),
        })
        .parse(input);
      if (d.id) await memberFor(tx, c, d.id);
      const profile = await tx.athleteProfile.findUnique({
        where: { publicId: d.publicId },
        include: { user: true },
      });
      ensure(
        profile,
        'No encontramos una cuenta personal con ese ID. Verifica el código con el cliente.',
        404,
      );
      const user = profile.user;
      ensure(
        user.emailVerified || user.phoneNumberVerified,
        'Pide al cliente que confirme su correo o teléfono antes de vincular su cuenta.',
        403,
      );
      const access = await tx.access.findUnique({
        where: { tenantId_userId: { tenantId: c.tenantId, userId: user.id } },
      });
      ensure(
        !access || access.role === 'CLIENT',
        'Esta cuenta es de un empleado de este gimnasio.',
      );
      ensure(
        !d.id ||
          !(await tx.member.findFirst({
            where: { tenantId: c.tenantId, userId: user.id, id: { not: d.id } },
          })),
        'La cuenta ya está vinculada a otro cliente.',
      );
      if (!d.id) {
        const linked = await tx.member.findFirst({
          where: { tenantId: c.tenantId, userId: user.id },
        });
        if (linked) return linked;
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
        const memberLimit = planInfo(
          effectivePlan(tenant.saasPlan, tenant.subscriptionExpiresAt),
        ).maxMembers;
        if (memberLimit !== null)
          ensure(
            (await tx.member.count({ where: { tenantId: c.tenantId } })) < memberLimit,
            `El plan Gratis permite hasta ${memberLimit} clientes. Cambia de plan para registrar más.`,
          );
      }
      await tx.access.upsert({
        where: { tenantId_userId: { tenantId: c.tenantId, userId: user.id } },
        create: { tenantId: c.tenantId, userId: user.id, role: 'CLIENT' },
        update: { active: true },
      });
      const result = d.id
        ? await tx.member.update({
            where: { id: d.id },
            data: { userId: user.id, name: user.name, email: user.email },
          })
        : await tx.member.create({
            data: {
              tenantId: c.tenantId,
              userId: user.id,
              name: user.name,
              email: user.email,
              phone: null,
            },
          });
      await audit(tx, c, action, result.id, { userId: user.id, publicId: profile.publicId });
      return result;
    }
    if (action === 'member.assign') {
      allow(c.role, ['OWNER', 'RECEPTION']);
      const d = z
        .object({ id: z.string(), trainerId: z.string(), accepted: z.literal(true) })
        .parse(input);
      await memberFor(tx, c, d.id);
      ensure(
        await tx.access.findFirst({
          where: { tenantId: c.tenantId, userId: d.trainerId, role: 'TRAINER', active: true },
        }),
        'Entrenador no disponible.',
      );
      ensure(
        await tx.membership.findFirst({
          where: {
            tenantId: c.tenantId,
            memberId: d.id,
            personalTraining: true,
            paid: true,
            status: 'ACTIVE',
            startsAt: { lte: new Date() },
            endsAt: { gt: new Date() },
          },
        }),
        'El cliente necesita una asesoría vigente y pagada.',
      );
      const result = await tx.member.update({
        where: { id: d.id },
        data: { trainerId: d.trainerId },
      });
      await audit(tx, c, action, d.id, { trainerId: d.trainerId, accepted: true });
      return result;
    }
    if (action === 'membership.request') {
      allow(c.role, ['CLIENT']);
      const d = z
        .object({ id: z.string(), reason: z.string().trim().min(5).max(500) })
        .parse(input);
      const m = await tx.membership.findFirst({ where: { id: d.id, tenantId: c.tenantId } });
      ensure(m, 'Membresía no encontrada.', 404);
      await memberFor(tx, c, m.memberId);
      ensure(
        m.status === 'ACTIVE' && m.endsAt > new Date(),
        'Solo puedes solicitar congelar una membresía vigente.',
      );
      ensure(
        !(await tx.freezeRequest.findFirst({
          where: { membershipId: m.id, tenantId: c.tenantId, status: 'PENDING' },
        })),
        'Ya hay una solicitud pendiente.',
      );
      const result = await tx.freezeRequest.create({
        data: { tenantId: c.tenantId, memberId: m.memberId, membershipId: m.id, reason: d.reason },
      });
      await audit(tx, c, action, m.id, { reason: d.reason });
      return result;
    }
    if (
      action === 'membership.freeze' ||
      action === 'membership.resume' ||
      action === 'membership.cancel'
    ) {
      allow(c.role, ['OWNER', 'RECEPTION']);
      const d = z
        .object({ id: z.string(), reason: z.string().trim().min(3).max(500) })
        .parse(input);
      const m = await tx.membership.findFirst({ where: { id: d.id, tenantId: c.tenantId } });
      ensure(m, 'Membresía no encontrada.', 404);
      const now = new Date();
      if (action === 'membership.freeze') {
        ensure(
          m.status === 'ACTIVE' && m.startsAt <= now,
          'Solo se pueden congelar membresías iniciadas y activas.',
        );
        await tx.membership.update({
          where: { id: m.id },
          data: {
            status: 'FROZEN',
            frozenAt: now,
            remainingMs: BigInt(freezeRemaining(m.endsAt, now)),
            freezeReason: d.reason,
          },
        });
        await tx.freezeRequest.updateMany({
          where: { tenantId: c.tenantId, membershipId: m.id, status: 'PENDING' },
          data: { status: 'APPROVED', resolvedAt: now },
        });
      } else if (action === 'membership.resume') {
        ensure(m.status === 'FROZEN' && m.remainingMs !== null, 'La membresía no está congelada.');
        const endsAt = new Date(now.getTime() + Number(m.remainingMs));
        ensure(
          !(await tx.membership.findFirst({
            where: {
              tenantId: c.tenantId,
              memberId: m.memberId,
              id: { not: m.id },
              status: 'ACTIVE',
              startsAt: { lt: endsAt },
              endsAt: { gt: now },
            },
          })),
          'La reactivación se empalma con otra membresía; ajusta o cancela la renovación primero.',
        );
        await tx.membership.update({
          where: { id: m.id },
          data: { status: 'ACTIVE', endsAt, remainingMs: null, frozenAt: null },
        });
      } else {
        ensure(m.status !== 'CANCELLED', 'La membresía ya está cancelada.');
        await tx.membership.update({ where: { id: m.id }, data: { status: 'CANCELLED' } });
      }
      await audit(tx, c, action, m.id, { reason: d.reason });
      return { ok: true };
    }
    if (action === 'membership.reject') {
      allow(c.role, ['OWNER', 'RECEPTION']);
      const d = z
        .object({ id: z.string(), reason: z.string().trim().min(3).max(500) })
        .parse(input);
      const request = await tx.freezeRequest.findFirst({
        where: { id: d.id, tenantId: c.tenantId, status: 'PENDING' },
      });
      ensure(request, 'Solicitud no encontrada.');
      await tx.freezeRequest.update({
        where: { id: d.id },
        data: { status: 'REJECTED', resolvedAt: new Date() },
      });
      await audit(tx, c, action, d.id, { reason: d.reason });
      return { ok: true };
    }
    if (action === 'visit.enter' || action === 'visit.exit') {
      allow(c.role, ['OWNER', 'RECEPTION']);
      const d = z.object({ token: z.string().min(1).max(200), branchId: z.string() }).parse(input);
      ensure(
        await tx.branch.findFirst({ where: { id: d.branchId, tenantId: c.tenantId } }),
        'Sucursal inválida.',
      );
      const member = await tx.member.findFirst({
        where: { tenantId: c.tenantId, OR: [{ qrToken: d.token }, { id: d.token }] },
        include: { memberships: true },
      });
      ensure(member, 'QR o cliente no encontrado en este gimnasio.', 404);
      const visit = await tx.visit.findFirst({
        where: { tenantId: c.tenantId, memberId: member.id, exitedAt: null },
      });
      if (action === 'visit.enter') {
        ensure(!visit, 'El cliente ya tiene una entrada abierta. Registra su salida primero.');
        ensure(
          member.memberships.some((m) => membershipAllows(m, d.branchId)),
          'Acceso denegado: revisa vigencia, pago, congelación y sucursal de la membresía.',
        );
        const result = await tx.visit.create({
          data: {
            tenantId: c.tenantId,
            memberId: member.id,
            branchId: d.branchId,
            actorId: c.userId,
          },
        });
        await audit(tx, c, action, result.id, { memberId: member.id });
        return { name: member.name, message: `Entrada registrada: ${member.name}` };
      }
      ensure(visit, 'No hay una entrada abierta para este cliente.');
      ensure(visit.branchId === d.branchId, 'La entrada pertenece a otra sucursal.');
      await tx.visit.update({ where: { id: visit.id }, data: { exitedAt: new Date() } });
      await audit(tx, c, action, visit.id, { memberId: member.id });
      return { name: member.name, message: `Salida registrada: ${member.name}` };
    }
    if (action === 'visit.closeStale') {
      allow(c.role, ['OWNER', 'RECEPTION']);
      const d = z.object({ branchId: z.string(), reason: z.string().trim().min(3) }).parse(input);
      const result = await tx.visit.updateMany({
        where: { tenantId: c.tenantId, branchId: d.branchId, exitedAt: null },
        data: { exitedAt: new Date(), automaticExit: true },
      });
      await audit(tx, c, action, d.branchId, { count: result.count, reason: d.reason });
      return result;
    }
    if (action === 'staff.clock') {
      allow(c.role, ['OWNER', 'RECEPTION', 'TRAINER']);
      const d = z.object({ direction: z.enum(['IN', 'OUT']) }).parse(input);
      const current = await tx.staffAttendance.findFirst({
        where: { tenantId: c.tenantId, userId: c.userId, exitedAt: null },
      });
      if (d.direction === 'IN') {
        ensure(!current, 'Ya registraste tu entrada.');
        const result = await tx.staffAttendance.create({
          data: { tenantId: c.tenantId, userId: c.userId },
        });
        await audit(tx, c, action, result.id, d);
        return result;
      }
      ensure(current, 'Primero registra tu entrada.');
      const result = await tx.staffAttendance.update({
        where: { id: current.id },
        data: { exitedAt: new Date() },
      });
      await audit(tx, c, action, result.id, d);
      return result;
    }
    throw new Error('Operación de clientes desconocida');
  });
}
