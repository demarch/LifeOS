import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { subscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Params { params: { id: string } }

export async function PATCH(request: Request, { params }: Params) {
  const body = await request.json();
  const updates: Partial<typeof subscriptions.$inferInsert> = {};
  if ('isActive' in body) updates.isActive = body.isActive ? 1 : 0;
  if ('amount' in body) updates.amount = body.amount;
  if ('billingDay' in body) updates.billingDay = body.billingDay;
  if ('name' in body) updates.name = body.name;

  db.update(subscriptions).set(updates).where(eq(subscriptions.id, params.id)).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: Params) {
  db.delete(subscriptions).where(eq(subscriptions.id, params.id)).run();
  return NextResponse.json({ ok: true });
}
