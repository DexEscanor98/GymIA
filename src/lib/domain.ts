import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
export const DAY_MS = 86_400_000;
export type Role = 'OWNER' | 'RECEPTION' | 'TRAINER' | 'CLIENT';
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function ensure(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new AppError(message, status);
}
export function allow(role: Role, roles: Role[]) {
  ensure(roles.includes(role), 'No tienes permiso para esta operación.', 403);
}
export function localDay(date: Date, zone: string) {
  return formatInTimeZone(date, zone, 'yyyy-MM-dd');
}
export function dayBounds(day: string, zone: string) {
  return {
    start: fromZonedTime(`${day}T00:00:00`, zone),
    end: fromZonedTime(`${day}T23:59:59.999`, zone),
  };
}
export function membershipState(
  m: { status: string; paid: boolean; startsAt: Date; endsAt: Date },
  now = new Date(),
) {
  if (m.status === 'CANCELLED') return 'Cancelada';
  if (m.status === 'FROZEN') return 'Congelada';
  if (!m.paid) return 'Pago pendiente';
  if (m.startsAt > now) return 'Por iniciar';
  if (m.endsAt <= now) return 'Vencida';
  return 'Activa';
}
export function membershipAllows(
  m: {
    status: string;
    paid: boolean;
    startsAt: Date;
    endsAt: Date;
    allBranches: boolean;
    branchIds: string[];
  },
  branchId: string,
  now = new Date(),
) {
  return membershipState(m, now) === 'Activa' && (m.allBranches || m.branchIds.includes(branchId));
}
export function freezeRemaining(endsAt: Date, now: Date) {
  ensure(endsAt > now, 'La membresía ya venció.');
  return endsAt.getTime() - now.getTime();
}
export function cashTotals(shift: {
  openingCents: number;
  sales: { totalCents: number; method: string }[];
  refunds: { totalCents: number; refundMethod: string | null }[];
  movements: { amountCents: number }[];
}) {
  const sum = (items: { totalCents: number }[]) => items.reduce((n, s) => n + s.totalCents, 0);
  const cash =
    sum(shift.sales.filter((s) => s.method === 'CASH')) -
    sum(shift.refunds.filter((s) => s.refundMethod === 'CASH'));
  const transfer =
    sum(shift.sales.filter((s) => s.method === 'TRANSFER')) -
    sum(shift.refunds.filter((s) => s.refundMethod === 'TRANSFER'));
  return {
    cash,
    transfer,
    net: cash + transfer,
    expected: shift.openingCents + cash + shift.movements.reduce((n, m) => n + m.amountCents, 0),
  };
}
export function openStatus(
  schedule: { weekday: number; closed: boolean; opens: string; closes: string }[],
  exceptions: {
    date: string;
    closed: boolean;
    opens: string | null;
    closes: string | null;
    reason: string;
  }[],
  zone: string,
  now = new Date(),
) {
  const date = localDay(now, zone),
    time = formatInTimeZone(now, zone, 'HH:mm');
  const weekday = Number(formatInTimeZone(now, zone, 'i')) % 7;
  const exception = exceptions.find((e) => e.date === date),
    rule = exception ?? schedule.find((s) => s.weekday === weekday);
  if (!rule) return { open: false, label: 'Horario sin configurar' };
  if (rule.closed) return { open: false, label: exception?.reason || 'Cerrado hoy' };
  return {
    open: !!rule.opens && !!rule.closes && time >= rule.opens && time < rule.closes,
    label: `${rule.opens} – ${rule.closes}`,
    reason: exception?.reason,
  };
}
