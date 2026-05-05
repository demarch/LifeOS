import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { baseListItems } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function GET() {
  const result = db.select().from(baseListItems).orderBy(asc(baseListItems.category)).all();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.insert(baseListItems).values({
    id,
    name: body.name,
    category: body.category ?? 'Outros',
    defaultQty: Math.max(1, Number(body.defaultQty ?? 1)),
    createdAt: now,
  }).run();

  return NextResponse.json({ id }, { status: 201 });
}
