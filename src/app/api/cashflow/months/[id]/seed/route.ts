import { NextResponse } from 'next/server';

interface Ctx { params: { id: string } }

export async function POST(_request: Request, _ctx: Ctx): Promise<Response> {
  return NextResponse.json({ error: 'NOT IMPLEMENTED' }, { status: 501 });
}
