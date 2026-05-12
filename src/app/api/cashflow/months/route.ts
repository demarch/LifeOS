import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { cashFlowMonths, cashFlowEntries } from '@/db/schema';
import { desc, eq, lt } from 'drizzle-orm';
import { monthSummary } from '@/lib/cashflow';

const toCamel = (m: typeof cashFlowMonths.$inferSelect) => m;

function monthNamePtBR(key: string): string {
  const [yearStr, monthStr] = key.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function newId(): string {
  return 'cfm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

export async function GET(_request: Request): Promise<Response> {
  const rows = db.select().from(cashFlowMonths).orderBy(desc(cashFlowMonths.key)).all();
  return NextResponse.json(rows.map(toCamel));
}

export async function POST(request: Request): Promise<Response> {
  let body: { key?: string; openingBalance?: number; inheritOpening?: number; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const key = body.key;
  if (!key || !/^\d{4}-\d{2}$/.test(key)) {
    return NextResponse.json({ error: 'missing or invalid key (YYYY-MM)' }, { status: 400 });
  }

  const existing = db.select().from(cashFlowMonths).where(eq(cashFlowMonths.key, key)).get();
  if (existing) {
    return NextResponse.json({ error: 'month with that key already exists' }, { status: 409 });
  }

  const inheritOpening = body.inheritOpening ?? 1;
  let openingBalance = body.openingBalance ?? 0;

  if (inheritOpening && body.openingBalance == null) {
    const prev = db
      .select()
      .from(cashFlowMonths)
      .where(lt(cashFlowMonths.key, key))
      .orderBy(desc(cashFlowMonths.key))
      .get();
    if (prev) {
      const prevEntries = db
        .select()
        .from(cashFlowEntries)
        .where(eq(cashFlowEntries.monthId, prev.id))
        .all();
      openingBalance = monthSummary(prev, prevEntries).closingBalance;
    }
  }

  const now = Date.now();
  const row = {
    id: newId(),
    key,
    name: body.name ?? monthNamePtBR(key),
    openingBalance,
    inheritOpening: inheritOpening ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(cashFlowMonths).values(row).run();
  return NextResponse.json(row, { status: 201 });
}
