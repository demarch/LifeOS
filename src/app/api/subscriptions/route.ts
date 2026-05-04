import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { subscriptions } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function GET() {
  const result = db.select().from(subscriptions).orderBy(asc(subscriptions.billingDay)).all();
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  db.insert(subscriptions).values({
    id,
    name: body.name,
    amount: body.amount,
    billingDay: body.billingDay,
    category: body.category ?? 'Outros',
    source: 'manual',
    alertDays: body.alertDays ?? 3,
    isActive: 1,
    createdAt: now,
  }).run();

  return NextResponse.json({ id }, { status: 201 });
}
