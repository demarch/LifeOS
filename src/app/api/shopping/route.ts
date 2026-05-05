import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { shoppingItems } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function GET() {
  const result = db.select().from(shoppingItems).orderBy(asc(shoppingItems.category)).all();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.insert(shoppingItems).values({
    id,
    name: body.name,
    category: body.category ?? 'Outros',
    qty: Math.max(1, Number(body.qty ?? 1)),
    isRecurring: body.isRecurring ? 1 : 0,
    isChecked: 0,
    baseListItemId: body.baseListItemId ?? null,
    createdAt: now,
  }).run();

  return NextResponse.json({ id }, { status: 201 });
}
