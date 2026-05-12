import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { cashFlowEntries, cashFlowMonths } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Ctx { params: { id: string } }

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  const existing = db.select().from(cashFlowEntries).where(eq(cashFlowEntries.id, ctx.params.id)).get();
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let body: {
    day?: number;
    description?: string;
    note?: string | null;
    entrada?: number;
    saida?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const patch: Partial<typeof cashFlowEntries.$inferInsert> = {};
  if (typeof body.day === 'number') {
    patch.day = body.day;
    const month = db.select().from(cashFlowMonths).where(eq(cashFlowMonths.id, existing.monthId)).get();
    if (month) patch.date = `${month.key}-${String(body.day).padStart(2, '0')}`;
  }
  if (typeof body.description === 'string') patch.description = body.description;
  if (body.note === null || typeof body.note === 'string') patch.note = body.note;
  if (typeof body.entrada === 'number') patch.entrada = body.entrada;
  if (typeof body.saida === 'number') patch.saida = body.saida;

  db.update(cashFlowEntries).set(patch).where(eq(cashFlowEntries.id, ctx.params.id)).run();
  db.update(cashFlowMonths)
    .set({ updatedAt: Date.now() })
    .where(eq(cashFlowMonths.id, existing.monthId))
    .run();

  const updated = db.select().from(cashFlowEntries).where(eq(cashFlowEntries.id, ctx.params.id)).get();
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const existing = db.select().from(cashFlowEntries).where(eq(cashFlowEntries.id, ctx.params.id)).get();
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  db.delete(cashFlowEntries).where(eq(cashFlowEntries.id, ctx.params.id)).run();
  db.update(cashFlowMonths)
    .set({ updatedAt: Date.now() })
    .where(eq(cashFlowMonths.id, existing.monthId))
    .run();

  return NextResponse.json({ ok: true });
}
