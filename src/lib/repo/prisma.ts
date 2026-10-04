import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import type { AccountRepository } from './types';
import { DuplicateAccountCodeError } from './types';

const select = {
  id: true,
  code: true,
  name: true,
  type: true,
  normalBalance: true,
  isActive: true,
  isSystem: true,
  createdAt: true,
} as const;

/** Prisma-backed repository. EVERY query filters by `orgId` (handbook §6.3). */
export const prismaAccountRepository: AccountRepository = {
  async list(orgId, filter, page) {
    const where: Prisma.AccountWhereInput = {
      orgId,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.isActive === undefined ? {} : { isActive: filter.isActive }),
    };
    const [rows, total] = await Promise.all([
      db.account.findMany({ where, select, orderBy: { code: 'asc' }, skip: page.skip, take: page.take }),
      db.account.count({ where }),
    ]);
    return { items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), total };
  },

  async create(orgId, userId, input) {
    try {
      const row = await db.account.create({
        data: { ...input, orgId, createdBy: userId, updatedBy: userId },
        select,
      });
      return { ...row, createdAt: row.createdAt.toISOString() };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DuplicateAccountCodeError(input.code);
      }
      throw error;
    }
  },
};
