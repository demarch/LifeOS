import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { cashFlowMonths, cashFlowEntries } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Ctx { params: { id: string } }

function newId(): string {
  return 'cfe_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  const month = db.select().from(cashFlowMonths).where(eq(cashFlowMonths.id, ctx.params.id)).get();
  if (!month) return NextResponse.json({ error: 'month not found' }, { status: 404 });

  let body: {
    day?: number;
    description?: string;
    note?: string | null;
    entrada?: number;
    saida?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (typeof body.day !== 'number' || body.day < 1 || body.day > 31) {
    return NextResponse.json({ error: 'missing or invalid day' }, { status: 400 });
  }

  const now = Date.now();
  const row = {
    id: newId(),
    monthId: month.id,
    day: body.day,
    date: `${month.key}-${String(body.day).padStart(2, '0')}`,
    description: body.description ?? '',
    note: body.note ?? null,
    entrada: body.entrada ?? 0,
    saida: body.saida ?? 0,
    source: 'manual',
    sourceRefId: null,
    createdAt: now,
  };

  db.insert(cashFlowEntries).values(row).run();
  db.update(cashFlowMonths).set({ updatedAt: now }).where(eq(cashFlowMonths.id, month.id)).run();
  return NextResponse.json(row, { status: 201 });
}
