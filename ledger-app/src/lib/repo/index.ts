import { env } from '@/lib/env';
export type RepositoryMode='mock'|'prisma';
export const repositoryMode:RepositoryMode=env.DATA_SOURCE;
export interface Repository<T>{ list():Promise<T[]>; }
