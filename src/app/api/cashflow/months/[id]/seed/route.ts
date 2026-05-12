import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { cashFlowMonths, cashFlowEntries, subscriptions, bills } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { autoSeedPlan } from '@/lib/cashflow';

interface Ctx { params: { id: string } }

function newId(): string {
  return 'cfe_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

export async function POST(_request: Request, ctx: Ctx): Promise<Response> {
  const month = db.select().from(cashFlowMonths).where(eq(cashFlowMonths.id, ctx.params.id)).get();
  if (!month) return NextResponse.json({ error: 'month not found' }, { status: 404 });

  const subs  = db.select().from(subscriptions).all();
  const billz = db.select().from(bills).all();

  const seedRows = autoSeedPlan(month.key, { subscriptions: subs, bills: billz });

  const now = Date.now();
  const inserted: typeof cashFlowEntries.$inferSelect[] = [];
  for (const r of seedRows) {
    const row = {
      id: newId(),
      monthId: month.id,
      day: r.day,
      date: r.date,
      description: r.description,
      note: r.note,
      entrada: r.entrada,
      saida: r.saida,
      source: r.source,
      sourceRefId: r.sourceRefId,
      createdAt: now,
    };
    const result = db.insert(cashFlowEntries).values(row).onConflictDoNothing().run();
    if (result.changes > 0) inserted.push(row);
  }

  db.update(cashFlowMonths)
    .set({ updatedAt: now })
    .where(eq(cashFlowMonths.id, month.id))
    .run();

  return NextResponse.json({ inserted });
}
