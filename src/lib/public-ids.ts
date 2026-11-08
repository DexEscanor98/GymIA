import { randomBytes } from 'node:crypto';

export type PublicIdKind = 'PER' | 'GYM' | 'SUC';

export function createPublicId(kind: PublicIdKind) {
  return `${kind}-${randomBytes(10).toString('hex').toUpperCase()}`;
}
