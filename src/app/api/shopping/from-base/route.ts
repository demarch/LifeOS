import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { baseListItems, shoppingItems } from '@/db/schema';
import { randomUUID } from 'crypto';

export async function POST() {
  const now = Math.floor(Date.now() / 1000);
  const base = db.select().from(baseListItems).all();
  const active = db.select().from(shoppingItems).all();

  const activeKeys = new Set(
    active.map(i => `${i.name.toLowerCase()}|${i.category.toLowerCase()}`)
  );

  const added: string[] = [];
  for (const item of base) {
    const key = `${item.name.toLowerCase()}|${item.category.toLowerCase()}`;
    if (activeKeys.has(key)) continue;

    const id = randomUUID();
    db.insert(shoppingItems).values({
      id,
      name: item.name,
      category: item.category,
      qty: item.defaultQty,
      isRecurring: 0,
      isChecked: 0,
      baseListItemId: item.id,
      createdAt: now,
    }).run();
    added.push(id);
  }

  return NextResponse.json({ added });
}
