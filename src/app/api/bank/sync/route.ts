import {NextRequest,NextResponse} from 'next/server';
import {withOrgAuth} from '@/lib/api/withOrgAuth';
export const POST=withOrgAuth(async(ctx,req:NextRequest)=>{const body=await req.json().catch(()=>({}));return NextResponse.json({jobId:crypto.randomUUID(),accountId:body.accountId||null,status:'QUEUED',retryPolicy:{maxAttempts:5,backoff:'exponential'},message:'Production queue worker must be connected before live AA polling.'},{status:202});});
