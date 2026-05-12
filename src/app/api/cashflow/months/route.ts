import { NextResponse } from 'next/server';

export async function GET(_request: Request): Promise<Response> {
  return NextResponse.json({ error: 'NOT IMPLEMENTED' }, { status: 501 });
}

export async function POST(_request: Request): Promise<Response> {
  return NextResponse.json({ error: 'NOT IMPLEMENTED' }, { status: 501 });
}
