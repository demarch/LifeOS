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
