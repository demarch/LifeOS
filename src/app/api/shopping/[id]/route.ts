import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { shoppingItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Params { params: { id: string } }

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json();
  const updates: Partial<typeof shoppingItems.$inferInsert> = {};
  if ('isChecked' in body) updates.isChecked = body.isChecked ? 1 : 0;
  if ('qty' in body) updates.qty = Math.max(1, Number(body.qty));
  if ('name' in body) updates.name = body.name;
  if ('category' in body) updates.category = body.category;
  if ('isRecurring' in body) updates.isRecurring = body.isRecurring ? 1 : 0;

  db.update(shoppingItems).set(updates).where(eq(shoppingItems.id, params.id)).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  db.delete(shoppingItems).where(eq(shoppingItems.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
