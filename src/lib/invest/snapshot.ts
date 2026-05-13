import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/db/client';
import { positions, portfolioSnapshots } from '@/db/schema';
import type { AssetClass, ClassTotals } from './types';

export interface AggregateInput {
  assetClass: AssetClass;
  currentValue: number;
}

export function aggregateByClass(positions: AggregateInput[]): ClassTotals {
  const totals: ClassTotals = { total: 0, stocks: 0, fiis: 0, fixedIncome: 0 };
  for (const p of positions) {
    totals.total += p.currentValue;
    if (p.assetClass === 'stock') totals.stocks += p.currentValue;
    else if (p.assetClass === 'fii') totals.fiis += p.currentValue;
    else totals.fixedIncome += p.currentValue;
  }
  return totals;
}

export interface CostInput {
  quantity: number;
  avgPrice: number;
}

export function computeTotalCost(positions: CostInput[]): number {
  return positions.reduce((sum, p) => sum + p.quantity * p.avgPrice, 0);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface PersistResult {
  snapshotDate: string;
  totalValue: number;
}

export async function persistToday(): Promise<PersistResult> {
  const rows = db.select({
    assetClass:   positions.assetClass,
    currentValue: positions.currentValue,
    quantity:     positions.quantity,
    avgPrice:     positions.avgPrice,
  }).from(positions).all();

  const totals = aggregateByClass(rows.map(r => ({ assetClass: r.assetClass as AssetClass, currentValue: r.currentValue })));
  const totalCost = computeTotalCost(rows);
  const date = today();
  const now = Math.floor(Date.now() / 1000);

  const existing = db.select().from(portfolioSnapshots).where(eq(portfolioSnapshots.snapshotDate, date)).get();
  if (existing) {
    db.update(portfolioSnapshots).set({
      totalValue:       totals.total,
      stocksValue:      totals.stocks,
      fiisValue:        totals.fiis,
      fixedIncomeValue: totals.fixedIncome,
      totalCost,
    }).where(eq(portfolioSnapshots.snapshotDate, date)).run();
  } else {
    db.insert(portfolioSnapshots).values({
      id:               randomUUID(),
      snapshotDate:     date,
      totalValue:       totals.total,
      stocksValue:      totals.stocks,
      fiisValue:        totals.fiis,
      fixedIncomeValue: totals.fixedIncome,
      totalCost,
      createdAt:        now,
    }).run();
  }

  return { snapshotDate: date, totalValue: totals.total };
}
