import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { positions } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = db.select().from(positions).orderBy(desc(positions.currentValue)).all();
  return NextResponse.json({ ok: true, positions: rows });
}
