import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { db } from '../src/lib/db';
import { execute } from '../src/server/operations';
import { workspace } from '../src/server/workspace';
import type { Context } from '../src/server/context';
import { DAY_MS } from '../src/lib/domain';
const safeHost = new URL(process.env.DATABASE_URL!).hostname;
if (!['localhost', '127.0.0.1', 'postgres'].includes(safeHost))
  throw new Error('Las pruebas de integración solo usan PostgreSQL local.');
let c: Context,
  other: Context,
  branch: string,
  otherBranch: string,
  product: string,
  member: string,
  plan: string,
  trainerId: string,
  clientId: string;
const users: string[] = [];
async function command(action: string, input: unknown, ctx = c) {
  return execute(ctx, { action, input }) as Promise<any>;
}
beforeAll(async () => {
  for (const n of ['owner', 'other', 'trainer', 'client']) {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `test-${id}@gymia.test`, name: n } });
    users.push(id);
  }
  trainerId = users[2];
  clientId = users[3];
  const a = await db.tenant.create({
    data: {
      name: 'INTEGRATION A',
      slug: `test-${randomUUID()}`,
      accesses: {
        create: [
          { userId: users[0], role: 'OWNER' },
          { userId: trainerId, role: 'TRAINER' },
          { userId: clientId, role: 'CLIENT' },
        ],
      },
      branches: { create: { name: 'Principal' } },
    },
    include: { branches: true },
  });
  const b = await db.tenant.create({
    data: {
      name: 'INTEGRATION B',
      slug: `test-${randomUUID()}`,
      accesses: { create: { userId: users[1], role: 'OWNER' } },
      branches: { create: { name: 'Otra' } },
    },
    include: { branches: true },
  });
  c = { tenantId: a.id, userId: users[0], role: 'OWNER', timezone: a.timezone };
  other = { tenantId: b.id, userId: users[1], role: 'OWNER', timezone: b.timezone };
  branch = a.branches[0].id;
  otherBranch = b.branches[0].id;
  product = (
    await command('product.save', {
      name: 'Preentreno',
      priceCents: 4500,
      stock: 30,
      reason: 'Inicial',
    })
  ).id;
  member = (
    await command('member.save', {
      name: 'Cliente prueba',
      email: '',
      phone: '',
      preference: 'WOMAN',
    })
  ).id;
  await db.member.update({ where: { id: member }, data: { userId: clientId, trainerId } });
  plan = (
    await command('plan.save', {
      name: 'Personal',
      priceCents: 140000,
      days: 30,
      personalTraining: true,
      allBranches: false,
      branchIds: [branch],
    })
  ).id;
  await command('shift.open', { branchId: branch, openingCents: 200000 });
});
afterAll(async () => {
  for (const ctx of [c, other]) {
    if (!ctx) continue;
    const where = { tenantId: ctx.tenantId };
    await db.auditLog.deleteMany({ where });
    await db.notification.deleteMany({ where });
    await db.freezeRequest.deleteMany({ where });
    await db.appointment.deleteMany({ where });
    await db.staffAttendance.deleteMany({ where });
    await db.visit.deleteMany({ where });
    await db.stockMovement.deleteMany({ where });
    await db.sale.deleteMany({ where });
    await db.cashMovement.deleteMany({ where });
    await db.shift.deleteMany({ where });
    await db.membership.deleteMany({ where });
    await db.member.deleteMany({ where });
    await db.plan.deleteMany({ where });
    await db.product.deleteMany({ where });
    await db.schedule.deleteMany({ where });
    await db.scheduleException.deleteMany({ where });
    await db.branch.deleteMany({ where });
    await db.access.deleteMany({ where });
    await db.tenant.delete({ where: { id: ctx.tenantId } });
  }
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
describe.sequential('operaciones reales con PostgreSQL', () => {
  it('vende una porción, repone 30 al cancelar y rechaza cancelar dos veces', async () => {
    const sale = await command('sale.create', {
      kind: 'PRODUCT',
      itemId: product,
      quantity: 1,
      method: 'CASH',
      idempotencyKey: randomUUID(),
    });
    expect((await db.product.findUniqueOrThrow({ where: { id: product } })).stock).toBe(29);
    await command('sale.cancel', {
      id: sale.id,
      reason: 'Cliente devuelve producto',
      restock: true,
      refundMethod: 'CASH',
    });
    expect((await db.product.findUniqueOrThrow({ where: { id: product } })).stock).toBe(30);
    await expect(
      command('sale.cancel', {
        id: sale.id,
        reason: 'Duplicada',
        restock: true,
        refundMethod: 'CASH',
      }),
    ).rejects.toThrow('ya fue cancelada');
  });
  it('conserva 29 y registra merma si el producto fue consumido', async () => {
    const sale = await command('sale.create', {
      kind: 'PRODUCT',
      itemId: product,
      quantity: 1,
      method: 'TRANSFER',
      reference: 'REF-1',
      idempotencyKey: randomUUID(),
    });
    await command('sale.cancel', {
      id: sale.id,
      reason: 'Producto consumido',
      restock: false,
      refundMethod: 'TRANSFER',
    });
    expect((await db.product.findUniqueOrThrow({ where: { id: product } })).stock).toBe(29);
    expect(await db.stockMovement.count({ where: { saleId: sale.id, kind: 'WASTE' } })).toBe(1);
  });
  it('un reintento de venta no cobra ni descuenta dos veces', async () => {
    const input = {
      kind: 'PRODUCT',
      itemId: product,
      quantity: 1,
      method: 'CASH',
      idempotencyKey: randomUUID(),
    };
    const first = await command('sale.create', input);
    const second = await command('sale.create', input);
    expect(first.id).toBe(second.id);
    expect((await db.product.findUniqueOrThrow({ where: { id: product } })).stock).toBe(28);
  });
  it('rechaza falta de existencias y transferencia sin referencia', async () => {
    await expect(
      command('sale.create', {
        kind: 'PRODUCT',
        itemId: product,
        quantity: 1000,
        method: 'CASH',
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow('Existencias');
    await expect(
      command('sale.create', {
        kind: 'PRODUCT',
        itemId: product,
        quantity: 1,
        method: 'TRANSFER',
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow('referencia');
  });
  it('bloquea operaciones de otro gimnasio y permisos de entrenador', async () => {
    await expect(
      command(
        'product.save',
        { id: product, name: 'Hack', priceCents: 1, stock: 100, reason: 'Ajuste' },
        other,
      ),
    ).rejects.toThrow('no encontrado');
    await expect(
      command(
        'product.save',
        { name: 'Hack', priceCents: 1, stock: 1, reason: 'Ajuste' },
        { ...c, userId: trainerId, role: 'TRAINER' },
      ),
    ).rejects.toThrow('permiso');
    const data = await workspace(other);
    expect(data.members).toHaveLength(0);
    expect(data.products).toHaveLength(0);
  });
  it('activa membresía por venta, procesa solicitud del cliente y conserva días', async () => {
    const sale = await command('sale.create', {
      kind: 'MEMBERSHIP',
      itemId: plan,
      memberId: member,
      quantity: 1,
      method: 'CASH',
      idempotencyKey: randomUUID(),
    });
    const id = sale.membershipId;
    await command(
      'membership.request',
      { id, reason: 'Recuperación de una lesión' },
      { ...c, userId: clientId, role: 'CLIENT' },
    );
    expect((await db.membership.findUniqueOrThrow({ where: { id } })).status).toBe('ACTIVE');
    await expect(
      command(
        'membership.freeze',
        { id, reason: 'Congelar' },
        { ...c, userId: clientId, role: 'CLIENT' },
      ),
    ).rejects.toThrow('permiso');
    await command('membership.freeze', { id, reason: 'Solicitud aprobada' });
    let m = await db.membership.findUniqueOrThrow({ where: { id } });
    expect(m.status).toBe('FROZEN');
    expect(Number(m.remainingMs)).toBeGreaterThan(29 * DAY_MS);
    await expect(command('visit.enter', { token: member, branchId: branch })).rejects.toThrow(
      'Acceso denegado',
    );
    await command('membership.resume', { id, reason: 'Alta del cliente' });
    m = await db.membership.findUniqueOrThrow({ where: { id } });
    expect(m.status).toBe('ACTIVE');
    expect(m.remainingMs).toBeNull();
  });
  it('rechaza sucursal externa, doble entrada y permite salida con deuda', async () => {
    await expect(command('visit.enter', { token: member, branchId: otherBranch })).rejects.toThrow(
      'Sucursal',
    );
    await command('visit.enter', { token: member, branchId: branch });
    await expect(command('visit.enter', { token: member, branchId: branch })).rejects.toThrow(
      'entrada abierta',
    );
    await db.membership.updateMany({ where: { memberId: member }, data: { paid: false } });
    await command('visit.exit', { token: member, branchId: branch });
    await expect(command('visit.enter', { token: member, branchId: branch })).rejects.toThrow(
      'Acceso denegado',
    );
    await db.membership.updateMany({ where: { memberId: member }, data: { paid: true } });
  });
  it('el cliente solo ve sus datos; el entrenador no recibe credenciales QR', async () => {
    const client = await workspace({ ...c, userId: clientId, role: 'CLIENT' });
    expect(client.members).toHaveLength(1);
    expect(client.members[0].id).toBe(member);
    expect(client.products).toHaveLength(0);
    expect(client.shifts).toHaveLength(0);
    const trainer = await workspace({ ...c, userId: trainerId, role: 'TRAINER' });
    expect(trainer.members[0].qrToken).toBe('');
    expect(trainer.sales).toHaveLength(0);
  });
  it('solo permite una sesión al día y el cliente puede evaluarla', async () => {
    const a = await command(
      'appointment.create',
      { memberId: member, startsAt: new Date().toISOString(), walkIn: true },
      { ...c, userId: trainerId, role: 'TRAINER' },
    );
    await expect(
      command('appointment.create', {
        memberId: member,
        startsAt: new Date().toISOString(),
        walkIn: true,
      }),
    ).rejects.toThrow('ese día');
    await command(
      'appointment.rate',
      { id: a.id, rating: 5, comment: 'Excelente orientación' },
      { ...c, userId: clientId, role: 'CLIENT' },
    );
    expect((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).rating).toBe(5);
  });
  it('la devolución en otro turno se contabiliza en ese segundo turno', async () => {
    const sale = await command('sale.create', {
      kind: 'PRODUCT',
      itemId: product,
      quantity: 1,
      method: 'CASH',
      idempotencyKey: randomUUID(),
    });
    const first = await db.shift.findFirstOrThrow({
      where: { tenantId: c.tenantId, closedAt: null },
    });
    await command('shift.close', { countedCents: 349000 });
    const second = await command('shift.open', { branchId: branch, openingCents: 10000 });
    await command('sale.cancel', {
      id: sale.id,
      reason: 'Devolución otro turno',
      restock: true,
      refundMethod: 'CASH',
    });
    const data = await workspace(c);
    expect(data.shifts.find((s) => s.id === first.id)!.refunds.some((s) => s.id === sale.id)).toBe(
      false,
    );
    expect(data.shifts.find((s) => s.id === second.id)!.totals.cash).toBe(-4500);
  });
  it('registra asistencia laboral sin duplicar entradas', async () => {
    const ctx = { ...c, userId: trainerId, role: 'TRAINER' as const };
    await command('staff.clock', { direction: 'IN' }, ctx);
    await expect(command('staff.clock', { direction: 'IN' }, ctx)).rejects.toThrow(
      'Ya registraste',
    );
    await command('staff.clock', { direction: 'OUT' }, ctx);
  });
  it('registra cliente con cuenta y contraseña inicial', async () => {
    const email = `cliente-${randomUUID()}@gymia.test`;
    const created = await command('member.save', {
      name: 'Cliente con cuenta',
      email,
      phone: '+5215555555555',
      preference: 'ANY',
      password: 'cliente-seguro-1234',
    });
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    users.push(user.id);
    expect(created.userId).toBe(user.id);
    expect(
      await db.access.findUnique({
        where: { tenantId_userId: { tenantId: c.tenantId, userId: user.id } },
      }),
    ).toMatchObject({ role: 'CLIENT', active: true });
  });
  it('el dueño registra empleados creando su cuenta si no existe', async () => {
    const email = `staff-${randomUUID()}@gymia.test`;
    const access = await command('staff.add', {
      name: 'Entrenador nuevo',
      email,
      password: 'empleado-seguro-1234',
      role: 'TRAINER',
    });
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    users.push(user.id);
    expect(access.userId).toBe(user.id);
    expect(access.role).toBe('TRAINER');
  });
  it('vende membresía con vencimiento manual y valida fechas', async () => {
    const localMember = (
      await command('member.save', {
        name: 'Cliente fechas',
        email: '',
        phone: '',
        preference: 'ANY',
      })
    ).id;
    const startsAt = new Date(Date.now() + DAY_MS);
    const endsAt = new Date(startsAt.getTime() + 45 * DAY_MS);
    const sale = await command('sale.create', {
      kind: 'MEMBERSHIP',
      itemId: plan,
      memberId: localMember,
      quantity: 1,
      method: 'CASH',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      idempotencyKey: randomUUID(),
    });
    const membership = await db.membership.findUniqueOrThrow({ where: { id: sale.membershipId } });
    expect(membership.endsAt.toISOString()).toBe(endsAt.toISOString());
    await expect(
      command('sale.create', {
        kind: 'MEMBERSHIP',
        itemId: plan,
        memberId: localMember,
        quantity: 1,
        method: 'CASH',
        startsAt: endsAt.toISOString(),
        endsAt: startsAt.toISOString(),
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow('vencimiento');
  });
  it('agenda entrenamiento con anticipación y rechaza fechas inválidas', async () => {
    const future = new Date(Date.now() + 20 * DAY_MS);
    const appointment = await command('appointment.create', {
      memberId: member,
      startsAt: future.toISOString(),
      walkIn: false,
    });
    expect(appointment.status).toBe('BOOKED');
    await expect(
      command('appointment.create', {
        memberId: member,
        startsAt: new Date(Date.now() - DAY_MS).toISOString(),
        walkIn: false,
      }),
    ).rejects.toThrow('pasado');
    await expect(
      command('appointment.create', {
        memberId: member,
        startsAt: new Date(Date.now() + 181 * DAY_MS).toISOString(),
        walkIn: false,
      }),
    ).rejects.toThrow('180 días');
  });
});

describe('logos aislados y almacenamiento acotado', () => {
  it('solo dueño; reemplaza sin acumular versiones y no toca otro gimnasio', async () => {
    const { saveLogo, optimizeLogo } = await import('../src/server/logo');
    const sharp = (await import('sharp')).default;
    const input = await sharp({
      create: { width: 1200, height: 600, channels: 4, background: '#c5f36b' },
    })
      .png()
      .toBuffer();
    const data = await optimizeLogo(input);
    const meta = await sharp(data).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(512);
    expect(data.length).toBeLessThanOrEqual(262144);
    await expect(saveLogo({ ...c, role: 'RECEPTION' }, data)).rejects.toThrow('permiso');
    await saveLogo(c, data);
    await saveLogo(c, data);
    expect(await db.tenantLogo.count({ where: { tenantId: c.tenantId } })).toBe(1);
    expect(await db.tenantLogo.count({ where: { tenantId: other.tenantId } })).toBe(0);
    await saveLogo(c, null);
    expect(await db.tenantLogo.count({ where: { tenantId: c.tenantId } })).toBe(0);
    expect((await db.tenant.findUniqueOrThrow({ where: { id: c.tenantId } })).logoUrl).toBeNull();
  });
  it('rechaza SVG y archivos sobredimensionados', async () => {
    const { optimizeLogo } = await import('../src/server/logo');
    await expect(optimizeLogo(Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toThrow('5 MB');
    await expect(
      optimizeLogo(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>'),
      ),
    ).rejects.toThrow('PNG');
  });
});
