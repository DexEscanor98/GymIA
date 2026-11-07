import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { db } from './db';
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  rateLimit: { enabled: true, window: 60, max: 40, storage: 'database' },
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    ...(process.env.NODE_ENV === 'production' ? [] : ['http://127.0.0.1:3000']),
  ],
});
