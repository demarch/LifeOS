import { NextResponse } from 'next/server';

interface Ctx { params: { id: string } }

export async function GET(_request: Request, _ctx: Ctx): Promise<Response> {
  return NextResponse.json({ error: 'NOT IMPLEMENTED' }, { status: 501 });
}

export async function PATCH(_request: Request, _ctx: Ctx): Promise<Response> {
  return NextResponse.json({ error: 'NOT IMPLEMENTED' }, { status: 501 });
}

export async function DELETE(_request: Request, _ctx: Ctx): Promise<Response> {
  return NextResponse.json({ error: 'NOT IMPLEMENTED' }, { status: 501 });
}
