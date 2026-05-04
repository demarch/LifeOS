import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { bills } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function GET() {
  const result = db.select().from(bills).orderBy(asc(bills.dueDay)).all();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.insert(bills).values({
    id,
    name: body.name,
    amount: body.amount ?? null,
    dueDay: body.dueDay,
    category: body.category ?? 'Outros',
    source: 'manual',
    isPaid: 0,
    needsReview: 0,
    createdAt: now,
  }).run();

  return NextResponse.json({ id }, { status: 201 });
}
