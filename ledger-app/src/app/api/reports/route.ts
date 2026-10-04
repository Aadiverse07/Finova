import { NextResponse } from 'next/server';
export async function GET(){return NextResponse.json({error:{code:'NOT_FOUND',message:'Specify a report endpoint'}},{status:404});}
