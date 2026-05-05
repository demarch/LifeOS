import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { shoppingSessionItems, shoppingSessions } from '@/db/schema';
import { buildFrequencyRanking } from '@/lib/shopping-frequency';

export async function GET() {
  const sessions = db.select().from(shoppingSessions).all();
  const sessionMap = new Map(sessions.map(s => [s.id, s.completedAt]));

  const items = db.select().from(shoppingSessionItems).all();
  const rows = items.map(i => ({
    name: i.name,
    category: i.category,
    completedAt: sessionMap.get(i.sessionId) ?? 0,
  }));

  const ranking = buildFrequencyRanking(rows);
  return NextResponse.json(ranking);
}
