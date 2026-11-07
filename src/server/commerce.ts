import { z } from 'zod';
import { allow, cashTotals, DAY_MS, ensure } from '@/lib/domain';
import { transaction, audit, openShift, memberFor } from './common';
import type { Context } from './context';
import { effectivePlan, planInfo } from '@/lib/saas-plans';
const cents = z.number().int().min(0).max(100_000_000);
const method = z.enum(['CASH', 'TRANSFER']);
export async function commerce(c: Context, action: string, input: unknown) {
  allow(c.role, ['OWNER', 'RECEPTION']);
  return transaction(async (tx) => {
    if (action === 'product.save') {
      const d = z
        .object({
          id: z.string().optional(),
          name: z.string().trim().min(2).max(100),
          priceCents: cents,
          stock: z.number().int().min(0).max(1_000_000),
          reason: z.string().trim().min(3).max(200),
        })
        .parse(input);
      const old = d.id
        ? await tx.product.findFirst({ where: { id: d.id, tenantId: c.tenantId } })
        : null;
      if (d.id) ensure(old, 'Producto no encontrado.', 404);
      else {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
        const productLimit = planInfo(
          effectivePlan(tenant.saasPlan, tenant.subscriptionExpiresAt),
        ).maxProducts;
        if (productLimit !== null) {
          ensure(
            (await tx.product.count({ where: { tenantId: c.tenantId } })) < productLimit,
            `El plan Gratis permite hasta ${productLimit} productos. Cambia de plan para registrar más.`,
          );
        }
      }
      const data = { name: d.name, priceCents: d.priceCents, stock: d.stock };
      const product = old
        ? await tx.product.update({ where: { id: old.id }, data })
        : await tx.product.create({ data: { ...data, tenantId: c.tenantId } });
      await tx.stockMovement.create({
        data: {
          tenantId: c.tenantId,
          productId: product.id,
          delta: d.stock - (old?.stock || 0),
          kind: 'ADJUSTMENT',
          reason: d.reason,
          actorId: c.userId,
        },
      });
      await audit(tx, c, action, product.id, { ...data, reason: d.reason });
      return product;
    }
    if (action === 'plan.save') {
      const d = z
        .object({
          id: z.string().optional(),
          name: z.string().trim().min(2).max(100),
          priceCents: cents,
          days: z.number().int().min(1).max(1095),
          personalTraining: z.boolean(),
          allBranches: z.boolean(),
          branchIds: z.array(z.string()),
        })
        .parse(input);
      const branches = await tx.branch.count({
        where: { tenantId: c.tenantId, id: { in: d.branchIds } },
      });
      ensure(branches === new Set(d.branchIds).size, 'Sucursal inválida.');
      ensure(d.allBranches || d.branchIds.length, 'Selecciona al menos una sucursal.');
      const { id, ...data } = d;
      if (id)
        ensure(
          await tx.plan.findFirst({ where: { id, tenantId: c.tenantId } }),
          'Plan no encontrado.',
          404,
        );
      const plan = id
        ? await tx.plan.update({ where: { id }, data })
        : await tx.plan.create({ data: { ...data, tenantId: c.tenantId } });
      await audit(tx, c, action, plan.id, data);
      return plan;
    }
    if (action === 'shift.open') {
      const d = z.object({ branchId: z.string(), openingCents: cents }).parse(input);
      ensure(
        await tx.branch.findFirst({ where: { id: d.branchId, tenantId: c.tenantId } }),
        'Sucursal inválida.',
      );
      ensure(
        !(await tx.shift.findFirst({
          where: { tenantId: c.tenantId, userId: c.userId, closedAt: null },
        })),
        'Ya tienes un turno abierto.',
      );
      const shift = await tx.shift.create({
        data: { ...d, tenantId: c.tenantId, userId: c.userId },
      });
      await audit(tx, c, action, shift.id, d);
      return shift;
    }
    if (action === 'shift.close') {
      const d = z.object({ countedCents: cents }).parse(input);
      const shift = await openShift(tx, c);
      const totals = cashTotals(shift);
      const result = await tx.shift.update({
        where: { id: shift.id },
        data: {
          closedAt: new Date(),
          countedCents: d.countedCents,
          expectedCents: totals.expected,
          transferCents: totals.transfer,
        },
      });
      await audit(tx, c, action, shift.id, { ...d, ...totals });
      return result;
    }
    if (action === 'shift.withdraw') {
      const d = z
        .object({ amountCents: cents.positive(), reason: z.string().trim().min(3).max(200) })
        .parse(input);
      const shift = await openShift(tx, c);
      ensure(cashTotals(shift).expected >= d.amountCents, 'No hay efectivo suficiente en caja.');
      const result = await tx.cashMovement.create({
        data: {
          tenantId: c.tenantId,
          shiftId: shift.id,
          amountCents: -d.amountCents,
          reason: d.reason,
        },
      });
      await audit(tx, c, action, result.id, d);
      return result;
    }
    if (action === 'sale.create') {
      const d = z
        .object({
          kind: z.enum(['PRODUCT', 'MEMBERSHIP']),
          itemId: z.string(),
          memberId: z.string().optional(),
          quantity: z.number().int().min(1).max(1000),
          method,
          reference: z.string().trim().max(100).optional(),
          startsAt: z.iso.datetime().optional(),
          endsAt: z.iso.datetime().optional(),
          idempotencyKey: z.uuid(),
        })
        .parse(input);
      const existing = await tx.sale.findUnique({
        where: {
          tenantId_idempotencyKey: { tenantId: c.tenantId, idempotencyKey: d.idempotencyKey },
        },
      });
      if (existing) return existing;
      ensure(
        d.method !== 'TRANSFER' || d.reference,
        'Confirma la transferencia e indica su referencia.',
      );
      const shift = await openShift(tx, c);
      if (d.memberId) await memberFor(tx, c, d.memberId);
      let label = '',
        unitCents = 0,
        productId: string | undefined,
        membershipId: string | undefined;
      if (d.kind === 'PRODUCT') {
        const p = await tx.product.findFirst({
          where: { id: d.itemId, tenantId: c.tenantId, active: true },
        });
        ensure(p, 'Producto no encontrado.', 404);
        ensure(p.stock >= d.quantity, 'Existencias insuficientes.');
        const updated = await tx.product.updateMany({
          where: { id: p.id, tenantId: c.tenantId, stock: { gte: d.quantity } },
          data: { stock: { decrement: d.quantity } },
        });
        ensure(updated.count === 1, 'Existencias insuficientes.');
        label = p.name;
        unitCents = p.priceCents;
        productId = p.id;
      } else {
        ensure(d.memberId, 'Selecciona un cliente.');
        ensure(d.quantity === 1, 'Vende una membresía por operación.');
        const p = await tx.plan.findFirst({
          where: { id: d.itemId, tenantId: c.tenantId, active: true },
        });
        ensure(p, 'Plan no encontrado.', 404);
        const startsAt = d.startsAt ? new Date(d.startsAt) : new Date(),
          defaultEndsAt = new Date(startsAt.getTime() + p.days * DAY_MS),
          endsAt = d.endsAt ? new Date(d.endsAt) : defaultEndsAt;
        ensure(!Number.isNaN(startsAt.getTime()), 'Fecha de inicio inválida.');
        ensure(!Number.isNaN(endsAt.getTime()), 'Fecha de vencimiento inválida.');
        ensure(endsAt > startsAt, 'El vencimiento debe ser posterior al inicio.');
        ensure(
          endsAt.getTime() - startsAt.getTime() <= 1095 * DAY_MS,
          'La membresía no puede exceder 1095 días.',
        );
        const overlapping = await tx.membership.findFirst({
          where: {
            tenantId: c.tenantId,
            memberId: d.memberId,
            status: { not: 'CANCELLED' },
            OR: [{ status: 'FROZEN' }, { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }],
          },
        });
        ensure(
          !overlapping,
          'El cliente ya tiene una membresía en ese periodo o una congelada. Para renovar, elige el vencimiento actual como inicio.',
        );
        const m = await tx.membership.create({
          data: {
            tenantId: c.tenantId,
            memberId: d.memberId,
            planId: p.id,
            planName: p.name,
            startsAt,
            endsAt,
            personalTraining: p.personalTraining,
            allBranches: p.allBranches,
            branchIds: p.branchIds,
          },
        });
        label = p.name;
        unitCents = p.priceCents;
        membershipId = m.id;
      }
      const sale = await tx.sale.create({
        data: {
          tenantId: c.tenantId,
          shiftId: shift.id,
          memberId: d.memberId,
          productId,
          membershipId,
          label,
          quantity: d.quantity,
          unitCents,
          totalCents: unitCents * d.quantity,
          method: d.method,
          reference: d.reference,
          idempotencyKey: d.idempotencyKey,
        },
      });
      if (productId)
        await tx.stockMovement.create({
          data: {
            tenantId: c.tenantId,
            productId,
            delta: -d.quantity,
            kind: 'SALE',
            reason: 'Venta',
            actorId: c.userId,
            saleId: sale.id,
          },
        });
      await audit(tx, c, action, sale.id, { totalCents: sale.totalCents, method: d.method });
      return sale;
    }
    if (action === 'sale.cancel') {
      const d = z
        .object({
          id: z.string(),
          reason: z.string().trim().min(3).max(300),
          restock: z.boolean(),
          refundMethod: method,
        })
        .parse(input);
      const sale = await tx.sale.findFirst({ where: { id: d.id, tenantId: c.tenantId } });
      ensure(sale, 'Venta no encontrada.', 404);
      ensure(!sale.cancelledAt, 'Esta venta ya fue cancelada.');
      const shift = await openShift(tx, c);
      if (d.refundMethod === 'CASH')
        ensure(
          cashTotals(shift).expected >= sale.totalCents,
          'No hay efectivo suficiente para esta devolución.',
        );
      if (sale.productId) {
        if (d.restock)
          await tx.product.update({
            where: { id: sale.productId },
            data: { stock: { increment: sale.quantity } },
          });
        await tx.stockMovement.create({
          data: {
            tenantId: c.tenantId,
            productId: sale.productId,
            delta: d.restock ? sale.quantity : 0,
            kind: d.restock ? 'RETURN' : 'WASTE',
            reason: d.reason,
            actorId: c.userId,
            saleId: sale.id,
          },
        });
      }
      if (sale.membershipId)
        await tx.membership.update({
          where: { id: sale.membershipId },
          data: { status: 'CANCELLED' },
        });
      const result = await tx.sale.update({
        where: { id: sale.id },
        data: {
          cancelledAt: new Date(),
          cancelReason: d.reason,
          refundShiftId: shift.id,
          refundMethod: d.refundMethod,
          restocked: d.restock,
        },
      });
      await audit(tx, c, action, sale.id, d);
      return result;
    }
    throw new Error('Operación comercial desconocida');
  });
}
