import { dataSource } from '@/lib/env';
import type { AccountRepository } from './types';
import { mockAccountRepository } from './mock';

export type RepositoryMode = 'mock' | 'prisma';
export const repositoryMode = (): RepositoryMode => dataSource();

/** Selected by DATA_SOURCE. The Prisma implementation is imported lazily so mock mode never loads a DB client. */
export async function getAccountRepository(): Promise<AccountRepository> {
  if (repositoryMode() === 'prisma') {
    return (await import('./prisma')).prismaAccountRepository;
  }
  return mockAccountRepository;
}

export * from './types';
