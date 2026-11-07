import { z } from 'zod';
import { AppError } from '@/lib/domain';
import type { Context } from './context';
import { commerce } from './commerce';
import { members } from './members';
import { training } from './training';
import { admin } from './admin';
const commercial = [
  'product.save',
  'plan.save',
  'shift.open',
  'shift.close',
  'shift.withdraw',
  'sale.create',
  'sale.cancel',
];
const memberActions = [
  'member.save',
  'member.link',
  'member.assign',
  'membership.request',
  'membership.freeze',
  'membership.resume',
  'membership.cancel',
  'membership.reject',
  'visit.enter',
  'visit.exit',
  'visit.closeStale',
  'staff.clock',
];
const trainingActions = [
  'appointment.create',
  'appointment.complete',
  'appointment.cancel',
  'appointment.rate',
];
const adminActions = [
  'tenant.save',
  'branch.create',
  'staff.add',
  'staff.toggle',
  'schedule.save',
  'exception.save',
];
export async function execute(c: Context, body: unknown) {
  const { action, input } = z.object({ action: z.string(), input: z.unknown() }).parse(body);
  if (commercial.includes(action)) return commerce(c, action, input);
  if (memberActions.includes(action)) return members(c, action, input);
  if (trainingActions.includes(action)) return training(c, action, input);
  if (adminActions.includes(action)) return admin(c, action, input);
  throw new AppError('Operación desconocida.', 404);
}
