import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { bills } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Params { params: { id: string } }

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json();
  const now = Math.floor(Date.now() / 1000);

  const updates: Partial<typeof bills.$inferInsert> = {};
  if ('isPaid' in body) {
    updates.isPaid = body.isPaid ? 1 : 0;
    updates.paidAt = body.isPaid ? now : null;
  }
  if ('name' in body) updates.name = body.name;
  if ('amount' in body) updates.amount = body.amount;
  if ('dueDay' in body) updates.dueDay = body.dueDay;
  if ('needsReview' in body) updates.needsReview = body.needsReview ? 1 : 0;

  db.update(bills).set(updates).where(eq(bills.id, params.id)).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  db.delete(bills).where(eq(bills.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
