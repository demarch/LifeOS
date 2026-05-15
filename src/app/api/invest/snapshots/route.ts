import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { portfolioSnapshots } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = db.select()
    .from(portfolioSnapshots)
    .orderBy(desc(portfolioSnapshots.snapshotDate))
    .limit(12)
    .all();
  return NextResponse.json({ ok: true, snapshots: rows });
}
