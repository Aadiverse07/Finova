import { NextRequest } from 'next/server';
import { ok, created, fail, validationError } from '@/lib/api/response';
import { withOrgAuth } from '@/lib/api/withOrgAuth';
import { parsePaginationParams, paginationToSkipTake, buildPaginationResponse } from '@/lib/api/pagination';
import { customerCreateSchema } from '@/lib/customers/schema';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { seedCustomers } from '@/lib/customers/seed';
import { serializeCustomer } from '@/lib/customers/format';

export const GET = withOrgAuth(async (ctx, req: NextRequest) => {
  if (!process.env.DATABASE_URL || process.env.DATA_SOURCE === 'mock') { const q=req.nextUrl.searchParams.get('q')?.trim().toLowerCase(); const items=seedCustomers.filter(c=>!q||`${c.displayName} ${c.email} ${c.phone} ${c.gstin||''}`.toLowerCase().includes(q)); return ok({dataSource:'mock',items:serializeCustomer(items),pagination:{page:1,limit:items.length||20,total:items.length,totalPages:items.length?1:0}}); }
  const p=parsePaginationParams(req.nextUrl.searchParams); const {skip,take}=paginationToSkipTake(p); const q=req.nextUrl.searchParams.get('q')?.trim();
  const where: Prisma.CustomerWhereInput={orgId:ctx.orgId, ...(q?{OR:[{displayName:{contains:q,mode:'insensitive'}},{legalName:{contains:q,mode:'insensitive'}},{gstin:{contains:q,mode:'insensitive'}},{phone:{contains:q}},{email:{contains:q,mode:'insensitive'}}]}:{})};
  const [items,total]=await Promise.all([db.customer.findMany({where,skip,take,orderBy:{displayName:'asc'},include:{contacts:true,addresses:true,tags:true}}),db.customer.count({where})]);
  return ok(buildPaginationResponse(items,total,p));
});

export const POST = withOrgAuth(async (ctx, req) => {
  const parsed=customerCreateSchema.safeParse(await req.json()); if(!parsed.success) return validationError(parsed.error); const x=parsed.data;
  if(!process.env.DATABASE_URL || process.env.DATA_SOURCE==='mock') return created({...x,id:`mock-${Date.now()}`});
  const row=await db.customer.create({data:{orgId:ctx.orgId,displayName:x.displayName,legalName:x.legalName,type:x.type==='business'?'BUSINESS':'INDIVIDUAL',phone:x.phone||null,email:x.email||null,gstin:x.gstin||null,pan:x.pan||null,gstTreatment:x.gstTreatment.toUpperCase() as never,tdsApplicable:x.tdsApplicable,tdsRate:x.tdsRate,paymentTermsDays:x.paymentTerms,currency:x.currency,defaultTaxRate:x.defaultTaxRate,creditLimitPaise:BigInt(x.creditLimitPaise),openingBalancePaise:BigInt(x.openingBalancePaise),preferredPaymentMethod:x.preferredPaymentMethod.toUpperCase().replace(' ','_') as never,discountTerms:x.discountTerms||null,category:x.category||null,assignedTo:x.assignedTo||null,source:x.source||null,customFields:x.customFields,status:'ACTIVE',createdBy:ctx.userId,updatedBy:ctx.userId,tags:{create:x.tags.map(value=>({orgId:ctx.orgId,value}))}},include:{tags:true}}); return created(row);
});
