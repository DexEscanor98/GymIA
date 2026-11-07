import { describe, it, expect } from 'vitest';
import {
  membershipState,
  membershipAllows,
  freezeRemaining,
  cashTotals,
  openStatus,
  DAY_MS,
} from '../src/lib/domain';
describe('reglas del gimnasio', () => {
  const now = new Date('2026-09-18T18:00:00Z');
  const active = {
    status: 'ACTIVE',
    paid: true,
    startsAt: new Date('2026-09-01'),
    endsAt: new Date('2026-10-01'),
    allBranches: false,
    branchIds: ['centro'],
  };
  it('distingue vencimiento, falta de pago y congelación', () => {
    expect(membershipState(active, now)).toBe('Activa');
    expect(membershipState({ ...active, paid: false }, now)).toBe('Pago pendiente');
    expect(membershipState({ ...active, status: 'FROZEN' }, now)).toBe('Congelada');
    expect(membershipState({ ...active, endsAt: now }, now)).toBe('Vencida');
  });
  it('restringe el acceso por sucursal', () => {
    expect(membershipAllows(active, 'norte', now)).toBe(false);
    expect(membershipAllows(active, 'centro', now)).toBe(true);
    expect(membershipAllows({ ...active, allBranches: true }, 'norte', now)).toBe(true);
  });
  it('conserva exactamente el tiempo restante al congelar', () => {
    expect(freezeRemaining(new Date(now.getTime() + 3.5 * DAY_MS), now)).toBe(3.5 * DAY_MS);
    expect(() => freezeRemaining(now, now)).toThrow();
  });
  it('el fondo no se cuenta como ingreso y la devolución afecta a su método real', () => {
    const totals = cashTotals({
      openingCents: 50000,
      sales: [
        { totalCents: 10000, method: 'CASH' },
        { totalCents: 20000, method: 'TRANSFER' },
      ],
      refunds: [{ totalCents: 5000, refundMethod: 'CASH' }],
      movements: [{ amountCents: -10000 }],
    });
    expect(totals).toEqual({ cash: 5000, transfer: 20000, net: 25000, expected: 45000 });
  });
  it('un cierre festivo prevalece sobre el horario habitual en hora local', () => {
    expect(
      openStatus(
        [{ weekday: 5, closed: false, opens: '06:00', closes: '22:00' }],
        [{ date: '2026-09-18', closed: true, opens: null, closes: null, reason: 'Festivo' }],
        'America/Mexico_City',
        now,
      ),
    ).toEqual({ open: false, label: 'Festivo' });
  });
});
