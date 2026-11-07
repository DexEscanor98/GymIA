import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
const globalDb = globalThis as unknown as { db?: PrismaClient };
export const db =
  globalDb.db ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    }),
  });
if (process.env.NODE_ENV !== 'production') globalDb.db = db;
