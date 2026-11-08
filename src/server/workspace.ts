import { db } from '@/lib/db';
import { cashTotals, dayBounds, localDay, membershipState } from '@/lib/domain';
import type { Context } from './context';
import { effectivePlan, planInfo } from '@/lib/saas-plans';
export async function workspace(c: Context, reportDay?: string) {
  const tenantRecord = await db.tenant.findUniqueOrThrow({ where: { id: c.tenantId } });
  const activePlan = effectivePlan(tenantRecord.saasPlan, tenantRecord.subscriptionExpiresAt);
  const features = { availability: planInfo(activePlan).paidFeatures };
  const staff = c.role === 'OWNER' || c.role === 'RECEPTION';
  const memberWhere = {
    tenantId: c.tenantId,
    ...(c.role === 'CLIENT'
      ? { userId: c.userId }
      : c.role === 'TRAINER'
        ? { trainerId: c.userId }
        : {}),
  };
  const memberRows = await db.member.findMany({
    where: memberWhere,
    include: { memberships: { orderBy: { endsAt: 'desc' } } },
    orderBy: { createdAt: 'desc' },
  });
  const ids = memberRows.map((m) => m.id);
  const day =
      reportDay && /^\d{4}-\d{2}-\d{2}$/.test(reportDay)
        ? reportDay
        : localDay(new Date(), c.timezone),
    { start, end } = dayBounds(day, c.timezone);
  const [
    branches,
    accesses,
    products,
    plans,
    sales,
    shifts,
    visits,
    attendance,
    appointments,
    schedules,
    exceptions,
    freezeRequests,
    logs,
    notifications,
    appNotifications,
    stockMovements,
    tenants,
    saasSubscriptions,
  ] = await Promise.all([
    db.branch.findMany({ where: { tenantId: c.tenantId } }),
    db.access.findMany({
      where: {
        tenantId: c.tenantId,
        ...(!staff ? { OR: [{ role: 'TRAINER' }, { userId: c.userId }] } : {}),
      },
      include: { user: { select: { id: true, name: true } } },
    }),
    staff ? db.product.findMany({ where: { tenantId: c.tenantId }, orderBy: { name: 'asc' } }) : [],
    db.plan.findMany({
      where: { tenantId: c.tenantId, active: true },
      orderBy: { priceCents: 'asc' },
    }),
    staff
      ? db.sale.findMany({
          where: { tenantId: c.tenantId },
          orderBy: { createdAt: 'desc' },
          take: 200,
        })
      : c.role === 'CLIENT'
        ? db.sale.findMany({
            where: { tenantId: c.tenantId, memberId: { in: ids } },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : [],
    staff
      ? db.shift.findMany({
          where: {
            tenantId: c.tenantId,
            OR: [{ openedAt: { gte: start, lte: end } }, { closedAt: null }],
          },
          include: { sales: true, refunds: true, movements: true },
          orderBy: { openedAt: 'desc' },
        })
      : [],
    db.visit.findMany({
      where: {
        tenantId: c.tenantId,
        ...(!staff ? { memberId: { in: ids } } : {}),
        OR: [{ enteredAt: { gte: start, lte: end } }, { exitedAt: null }],
      },
      orderBy: { enteredAt: 'desc' },
      take: 1000,
    }),
    db.staffAttendance.findMany({
      where: {
        tenantId: c.tenantId,
        ...(c.role !== 'OWNER' ? { userId: c.userId } : {}),
        OR: [{ enteredAt: { gte: start, lte: end } }, { exitedAt: null }],
      },
      orderBy: { enteredAt: 'desc' },
    }),
    db.appointment.findMany({
      where: {
        tenantId: c.tenantId,
        ...(!staff ? { memberId: { in: ids } } : {}),
        ...(c.role === 'TRAINER' ? { trainerId: c.userId } : {}),
      },
      orderBy: { startsAt: 'desc' },
      take: 200,
    }),
    db.schedule.findMany({ where: { tenantId: c.tenantId }, orderBy: { weekday: 'asc' } }),
    db.scheduleException.findMany({
      where: { tenantId: c.tenantId },
      orderBy: { date: 'desc' },
      take: 100,
    }),
    db.freezeRequest.findMany({
      where: {
        tenantId: c.tenantId,
        ...(!staff ? { memberId: { in: ids } } : {}),
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    }),
    c.role === 'OWNER'
      ? db.auditLog.findMany({
          where: { tenantId: c.tenantId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : [],
    c.role === 'CLIENT' && features.availability
      ? db.notification.findMany({
          where: { tenantId: c.tenantId, memberId: { in: ids } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [],
    c.role === 'OWNER'
      ? db.appNotification.findMany({
          where: { userId: c.userId, tenantId: c.tenantId, readAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : [],
    staff
      ? db.stockMovement.findMany({
          where: { tenantId: c.tenantId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : [],
    db.access.findMany({
      where: { userId: c.userId, active: true },
      include: { tenant: { select: { id: true, name: true } } },
    }),
    c.role === 'OWNER'
      ? db.saasSubscription.findMany({
          where: { tenantId: c.tenantId },
          include: { payments: { orderBy: { createdAt: 'desc' }, take: 5 } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : [],
  ]);
  const [daySales, dayRefunds] = staff
    ? await Promise.all([
        db.sale.findMany({
          where: { tenantId: c.tenantId, createdAt: { gte: start, lte: end } },
          select: { totalCents: true, method: true },
        }),
        db.sale.findMany({
          where: { tenantId: c.tenantId, cancelledAt: { gte: start, lte: end } },
          select: { totalCents: true, refundMethod: true },
        }),
      ])
    : [[], []];
  const dailyTotals = cashTotals({
    openingCents: 0,
    sales: daySales,
    refunds: dayRefunds,
    movements: [],
  });
  const occupancy = await db.visit.groupBy({
    by: ['branchId'],
    where: { tenantId: c.tenantId, exitedAt: null },
    _count: { _all: true },
  });
  return {
    context: c,
    dailyTotals,
    tenant: { ...tenantRecord, saasPlan: activePlan },
    features,
    branches,
    tenants: tenants.map((t) => t.tenant),
    saasSubscriptions,
    members: memberRows.map((m) => ({
      ...m,
      ...(c.role === 'TRAINER' ? { email: null, phone: null, qrToken: '' } : {}),
      memberships: m.memberships.map((s) => ({ ...s, displayStatus: membershipState(s) })),
    })),
    accesses,
    products,
    plans,
    sales,
    shifts: shifts.map((s) => ({ ...s, totals: cashTotals(s) })),
    visits,
    attendance,
    appointments,
    schedules,
    exceptions,
    freezeRequests,
    logs,
    notifications,
    appNotifications,
    stockMovements,
    occupancy,
    reportDay: day,
  };
}
export type Workspace = Awaited<ReturnType<typeof workspace>>;
