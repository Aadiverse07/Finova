import {NextRequest,NextResponse} from 'next/server';
import {withOrgAuth} from '@/lib/api/withOrgAuth';
export const POST=withOrgAuth(async(ctx,req:NextRequest)=>{const body=await req.json();if(!body.transactionId)return NextResponse.json({error:'transactionId is required'},{status:400});return NextResponse.json({transactionId:body.transactionId,status:body.status||'CATEGORISED',category:body.category||null,customerId:body.customerId||null,invoiceIds:body.invoiceIds||[]});});
