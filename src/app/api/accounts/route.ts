import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const result = db.select().from(accounts).orderBy(desc(accounts.updatedAt)).all();
  return NextResponse.json(result);
}
