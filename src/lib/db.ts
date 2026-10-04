import { PrismaClient } from '@prisma/client';

/**
 * App-local re-export point for the Prisma client (docs: import `db` from `@/lib/db`, never
 * construct clients elsewhere - this indirection lets tests swap it). At integration this becomes
 * `export { db } from "@quikit/database";`.
 * Imported lazily, and only when DATA_SOURCE=prisma.
 */
const globalForPrisma = globalThis as unknown as { __finovaPrisma?: PrismaClient };

function create(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when DATA_SOURCE=prisma');
  }
  return new PrismaClient();
}

export const db: PrismaClient = globalForPrisma.__finovaPrisma ?? create();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__finovaPrisma = db;
