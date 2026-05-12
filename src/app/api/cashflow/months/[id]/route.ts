import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { cashFlowMonths } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Ctx { params: { id: string } }

export async function GET(_request: Request, ctx: Ctx): Promise<Response> {
  const row = db.select().from(cashFlowMonths).where(eq(cashFlowMonths.id, ctx.params.id)).get();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const existing = db.select().from(cashFlowMonths).where(eq(cashFlowMonths.id, ctx.params.id)).get();
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let body: { name?: string; openingBalance?: number; inheritOpening?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const patch: Partial<typeof cashFlowMonths.$inferInsert> = { updatedAt: Date.now() };
  if (typeof body.name === 'string') patch.name = body.name;
  if (typeof body.openingBalance === 'number') patch.openingBalance = body.openingBalance;
  if (body.inheritOpening === 0 || body.inheritOpening === 1) patch.inheritOpening = body.inheritOpening;

  db.update(cashFlowMonths).set(patch).where(eq(cashFlowMonths.id, ctx.params.id)).run();
  const updated = db.select().from(cashFlowMonths).where(eq(cashFlowMonths.id, ctx.params.id)).get();
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const existing = db.select().from(cashFlowMonths).where(eq(cashFlowMonths.id, ctx.params.id)).get();
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  db.delete(cashFlowMonths).where(eq(cashFlowMonths.id, ctx.params.id)).run();
  return NextResponse.json({ ok: true });
}
