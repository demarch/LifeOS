import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { shoppingSessionItems } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Params { params: { id: string } }

export async function GET(_: Request, { params }: Params) {
  const items = db.select().from(shoppingSessionItems)
    .where(eq(shoppingSessionItems.sessionId, params.id)).all();
  return NextResponse.json(items);
}
