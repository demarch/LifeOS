import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { shoppingItems, shoppingSessions, shoppingSessionItems } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function POST() {
  const now = Math.floor(Date.now() / 1000);
  const allItems = db.select().from(shoppingItems).all();
  const checkedItems = allItems.filter(i => i.isChecked);

  if (checkedItems.length === 0) {
    return NextResponse.json({ ok: true, sessionId: null });
  }

  const sessionId = randomUUID();
  db.insert(shoppingSessions).values({
    id: sessionId,
    completedAt: now,
    totalItems: allItems.length,
    totalChecked: checkedItems.length,
  }).run();

  for (const item of checkedItems) {
    db.insert(shoppingSessionItems).values({
      id: randomUUID(),
      sessionId,
      name: item.name,
      category: item.category,
      qty: item.qty,
      baseListItemId: item.baseListItemId ?? null,
    }).run();
    db.delete(shoppingItems).where(eq(shoppingItems.id, item.id)).run();
  }

  return NextResponse.json({ ok: true, sessionId });
}

export async function GET() {
  const sessions = db.select().from(shoppingSessions)
    .orderBy(desc(shoppingSessions.completedAt)).all();
  return NextResponse.json(sessions);
}
