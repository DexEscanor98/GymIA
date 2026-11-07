import type { SaasPlan } from '@/generated/prisma/client';

export const saasPlans = {
  FREE: {
    name: 'Gratis',
    priceCents: 0,
    maxBranches: 1,
    maxProducts: 5,
    maxMembers: 30,
    maxEmployees: 3,
    paidFeatures: false,
  },
  LITE: {
    name: 'Lite',
    priceCents: 13_900,
    maxBranches: 1,
    maxProducts: null,
    maxMembers: null,
    maxEmployees: 3,
    paidFeatures: false,
  },
  BASIC: {
    name: 'Básico',
    priceCents: 35_000,
    maxBranches: 2,
    maxProducts: null,
    maxMembers: null,
    maxEmployees: null,
    paidFeatures: true,
  },
  STANDARD: {
    name: 'Estándar',
    priceCents: 55_000,
    maxBranches: 6,
    maxProducts: null,
    maxMembers: null,
    maxEmployees: null,
    paidFeatures: true,
  },
  PREMIUM: {
    name: 'Premium',
    priceCents: 85_000,
    maxBranches: 10,
    maxProducts: null,
    maxMembers: null,
    maxEmployees: null,
    paidFeatures: true,
  },
} satisfies Record<
  SaasPlan,
  {
    name: string;
    priceCents: number;
    maxBranches: number;
    maxProducts: number | null;
    maxMembers: number | null;
    maxEmployees: number | null;
    paidFeatures: boolean;
  }
>;

export function planInfo(plan: SaasPlan) {
  return saasPlans[plan];
}

export function effectivePlan(plan: SaasPlan, expiresAt: Date | string | null, now = new Date()) {
  if (plan === 'FREE') return 'FREE';
  if (expiresAt && new Date(expiresAt) <= now) return 'FREE';
  return plan;
}
