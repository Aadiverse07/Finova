import { withOrgAuth } from '@/lib/api/withOrgAuth';
import { fail } from '@/lib/api/response';

export const GET = withOrgAuth(async () => fail('Specify a report endpoint', 404));
