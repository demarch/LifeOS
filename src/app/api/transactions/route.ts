import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { desc, eq, and } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const accountId = searchParams.get('accountId');

  let query = db.select().from(transactions).$dynamic();

  if (category && category !== 'all') {
    query = query.where(eq(transactions.category, category));
  }
  if (accountId && accountId !== 'all') {
    query = query.where(eq(transactions.accountId, accountId));
  }

  const result = query.orderBy(desc(transactions.date)).all();
  return NextResponse.json(result);
}
