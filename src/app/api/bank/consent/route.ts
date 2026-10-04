import {NextRequest,NextResponse} from 'next/server';
import {withOrgAuth} from '@/lib/api/withOrgAuth';
export const POST=withOrgAuth(async(ctx,req:NextRequest)=>{const body=await req.json();const provider=String(body.provider||'sandbox-aa');const accountId=String(body.accountId||'');if(!accountId)return NextResponse.json({error:'accountId is required'},{status:400});return NextResponse.json({status:'PENDING',provider,accountId,purpose:'Finova bookkeeping and cash-flow reconciliation',fiTypes:['DEPOSIT'],redirectUrl:null,sandbox:provider==='sandbox-aa'});});
export const DELETE=withOrgAuth(async(ctx,req:NextRequest)=>NextResponse.json({status:'REVOKED',message:'Consent revocation must be propagated to the selected AA provider before production launch.'}));
