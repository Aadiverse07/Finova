import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';
export const env = createEnv({ server: { DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')), DATA_SOURCE: z.enum(['mock','prisma']).default('mock'), BUSINESS_STATE: z.string().default('Madhya Pradesh'), ENABLE_DEMO_ROUTES: z.enum(['true','false']).default('false').transform(v=>v==='true') }, client: {}, runtimeEnv: process.env, skipValidation: process.env.NODE_ENV === 'test' });
