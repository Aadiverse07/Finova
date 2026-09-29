import { NextResponse } from 'next/server';
export async function GET(){return NextResponse.json({openapi:'3.0.0',info:{title:'Ledger API',version:'0.1.0'},paths:{}});}
