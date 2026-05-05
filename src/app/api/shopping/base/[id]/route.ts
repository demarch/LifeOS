import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { baseListItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Params { params: { id: string } }

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json();
  const updates: Partial<typeof baseListItems.$inferInsert> = {};
  if ('name' in body) updates.name = body.name;
  if ('category' in body) updates.category = body.category;
  if ('defaultQty' in body) updates.defaultQty = Math.max(1, Number(body.defaultQty));

  db.update(baseListItems).set(updates).where(eq(baseListItems.id, params.id)).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  db.delete(baseListItems).where(eq(baseListItems.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
