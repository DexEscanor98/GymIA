import { z } from 'zod';
import { allow, ensure } from '@/lib/domain';
import { transaction, audit } from './common';
import type { Context } from './context';
import { provisionUser } from './accounts';
import { effectivePlan, planInfo } from '@/lib/saas-plans';
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export async function admin(c: Context, action: string, input: unknown) {
  allow(c.role, ['OWNER']);
  if (action === 'staff.add') {
    const d = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email(),
        password: z.string().min(12).max(100).optional().or(z.literal('')),
        role: z.enum(['RECEPTION', 'TRAINER']),
      })
      .parse(input);
    const user = await provisionUser({ name: d.name, email: d.email, password: d.password });
    return transaction(async (tx) => {
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
      const employeeLimit = planInfo(
        effectivePlan(tenant.saasPlan, tenant.subscriptionExpiresAt),
      ).maxEmployees;
      if (employeeLimit !== null) {
        const employeeCount = await tx.access.count({
          where: { tenantId: c.tenantId, active: true, role: { in: ['RECEPTION', 'TRAINER'] } },
        });
        ensure(
          employeeCount < employeeLimit,
          `El plan Gratis permite hasta ${employeeLimit} empleados. Cambia de plan para registrar más.`,
        );
      }
      ensure(
        !(await tx.access.findFirst({ where: { tenantId: c.tenantId, userId: user.id } })),
        'Esta persona ya tiene un rol en el gimnasio.',
      );
      const result = await tx.access.create({
        data: { tenantId: c.tenantId, userId: user.id, role: d.role },
      });
      await audit(tx, c, action, result.id, { email: d.email, role: d.role });
      return result;
    });
  }
  return transaction(async (tx) => {
    if (action === 'tenant.save') {
      const d = z
        .object({
          name: z.string().trim().min(2).max(80),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          timezone: z.string().refine((v) => {
            try {
              Intl.DateTimeFormat('en', { timeZone: v });
              return true;
            } catch {
              return false;
            }
          }, 'Zona horaria inválida'),
          capacity: z.number().int().min(1).max(100000),
          comfortableCapacity: z.number().int().min(1).max(100000),
        })
        .parse(input);
      ensure(
        d.comfortableCapacity <= d.capacity,
        'La ocupación cómoda no puede superar la capacidad.',
      );
      const result = await tx.tenant.update({
        where: { id: c.tenantId },
        data: d,
      });
      await audit(tx, c, action, c.tenantId, d);
      return result;
    }
    if (action === 'tenant.plan') {
      const d = z.object({ saasPlan: z.literal('FREE') }).parse(input);
      const current = await tx.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
      ensure(
        current.saasPlan === 'FREE' ||
          !current.subscriptionExpiresAt ||
          current.subscriptionExpiresAt <= new Date(),
        'Para cancelar un plan activo, gestiona la renovación desde Mercado Pago.',
        409,
      );
      const selected = planInfo(d.saasPlan);
      if (selected.maxProducts !== null)
        ensure(
          (await tx.product.count({ where: { tenantId: c.tenantId } })) <= selected.maxProducts,
          `El plan Gratis admite hasta ${selected.maxProducts} productos. Reduce el catálogo antes de cambiar.`,
        );
      if (selected.maxMembers !== null)
        ensure(
          (await tx.member.count({ where: { tenantId: c.tenantId } })) <= selected.maxMembers,
          `El plan Gratis admite hasta ${selected.maxMembers} clientes. Reduce los registros antes de cambiar.`,
        );
      if (selected.maxEmployees !== null)
        ensure(
          (await tx.access.count({
            where: { tenantId: c.tenantId, active: true, role: { in: ['RECEPTION', 'TRAINER'] } },
          })) <= selected.maxEmployees,
          `El plan Gratis admite hasta ${selected.maxEmployees} empleados activos.`,
        );
      ensure(
        (await tx.branch.count({ where: { tenantId: c.tenantId } })) <= selected.maxBranches,
        `El plan ${selected.name} admite hasta ${selected.maxBranches} sucursal(es).`,
      );
      const result = await tx.tenant.update({
        where: { id: c.tenantId },
        data: { saasPlan: 'FREE', subscriptionExpiresAt: null },
      });
      await audit(tx, c, action, c.tenantId, d);
      return result;
    }
    if (action === 'branch.create') {
      const d = z.object({ name: z.string().trim().min(2).max(80) }).parse(input);
      const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
      ensure(
        (await tx.branch.count({ where: { tenantId: c.tenantId } })) <
          planInfo(effectivePlan(tenant.saasPlan, tenant.subscriptionExpiresAt)).maxBranches,
        `Tu plan ${planInfo(effectivePlan(tenant.saasPlan, tenant.subscriptionExpiresAt)).name} permite hasta ${planInfo(effectivePlan(tenant.saasPlan, tenant.subscriptionExpiresAt)).maxBranches} sucursal(es).`,
      );
      const b = await tx.branch.create({ data: { tenantId: c.tenantId, ...d } });
      await tx.schedule.createMany({
        data: Array.from({ length: 7 }, (_, weekday) => ({
          tenantId: c.tenantId,
          branchId: b.id,
          weekday,
          opens: '06:00',
          closes: '22:00',
          closed: weekday === 0,
        })),
      });
      await audit(tx, c, action, b.id, d);
      return b;
    }
    if (action === 'staff.toggle') {
      const d = z.object({ id: z.string(), active: z.boolean() }).parse(input);
      const access = await tx.access.findFirst({ where: { tenantId: c.tenantId, id: d.id } });
      ensure(access && access.role !== 'OWNER', 'No puedes desactivar al dueño.');
      const result = await tx.access.update({
        where: { id: access.id },
        data: { active: d.active },
      });
      await audit(tx, c, action, access.id, d);
      return result;
    }
    if (action === 'schedule.save') {
      const d = z
        .object({
          branchId: z.string(),
          weekday: z.number().int().min(0).max(6),
          closed: z.boolean(),
          opens: time,
          closes: time,
        })
        .parse(input);
      ensure(
        await tx.branch.findFirst({ where: { tenantId: c.tenantId, id: d.branchId } }),
        'Sucursal inválida.',
      );
      ensure(d.closed || d.opens < d.closes, 'La hora de cierre debe ser posterior a la apertura.');
      const result = await tx.schedule.upsert({
        where: {
          tenantId_branchId_weekday: {
            tenantId: c.tenantId,
            branchId: d.branchId,
            weekday: d.weekday,
          },
        },
        create: { tenantId: c.tenantId, ...d },
        update: d,
      });
      await audit(tx, c, action, result.id, d);
      return result;
    }
    if (action === 'exception.save') {
      const d = z
        .object({
          branchId: z.string(),
          date: z.iso.date(),
          closed: z.boolean(),
          opens: time,
          closes: time,
          reason: z.string().trim().min(3).max(200),
        })
        .parse(input);
      ensure(
        await tx.branch.findFirst({ where: { tenantId: c.tenantId, id: d.branchId } }),
        'Sucursal inválida.',
      );
      ensure(d.closed || d.opens < d.closes, 'Revisa las horas de apertura y cierre.');
      const result = await tx.scheduleException.upsert({
        where: {
          tenantId_branchId_date: { tenantId: c.tenantId, branchId: d.branchId, date: d.date },
        },
        create: { tenantId: c.tenantId, ...d },
        update: d,
      });
      await audit(tx, c, action, result.id, d);
      return result;
    }
    throw new Error('Operación de administración desconocida');
  });
}
