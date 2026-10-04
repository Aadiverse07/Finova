import { NextRequest } from 'next/server'; import { ok } from '@/lib/api/response'; import { withOrgAuth } from '@/lib/api/withOrgAuth';
const idOf=(req:NextRequest)=>req.nextUrl.pathname.split('/').filter(Boolean).at(-2)||'';
export const GET=withOrgAuth(async(_ctx,req)=>ok({customerId:idOf(req),from:req.nextUrl.searchParams.get('from'),to:req.nextUrl.searchParams.get('to'),format:req.nextUrl.searchParams.get('format')||'json',message:'Statement data is generated from customer ledger; PDF rendering is client-side print-to-PDF in this standalone build.'}));
