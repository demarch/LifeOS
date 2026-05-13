import { describe, it, expect } from 'vitest';
import { aggregateByClass, computeTotalCost } from '@/lib/invest/snapshot';

interface PosLike {
  assetClass: 'stock' | 'fii' | 'fixed_income';
  currentValue: number;
  quantity: number;
  avgPrice: number;
}

const mk = (over: Partial<PosLike>): PosLike => ({
  assetClass: 'stock',
  currentValue: 0,
  quantity: 0,
  avgPrice: 0,
  ...over,
});

describe('aggregateByClass', () => {
  it('sums currentValue per asset class and exposes total', () => {
    const result = aggregateByClass([
      mk({ assetClass: 'stock', currentValue: 1000 }),
      mk({ assetClass: 'stock', currentValue: 500 }),
      mk({ assetClass: 'fii', currentValue: 2000 }),
      mk({ assetClass: 'fixed_income', currentValue: 750 }),
    ]);
    expect(result.stocks).toBe(1500);
    expect(result.fiis).toBe(2000);
    expect(result.fixedIncome).toBe(750);
    expect(result.total).toBe(4250);
  });

  it('returns zeros for empty input', () => {
    expect(aggregateByClass([])).toEqual({ total: 0, stocks: 0, fiis: 0, fixedIncome: 0 });
  });

  it('returns zero for a class with no positions', () => {
    const result = aggregateByClass([mk({ assetClass: 'stock', currentValue: 100 })]);
    expect(result.fiis).toBe(0);
    expect(result.fixedIncome).toBe(0);
  });
});

describe('computeTotalCost', () => {
  it('sums quantity * avgPrice across positions', () => {
    expect(computeTotalCost([
      mk({ quantity: 100, avgPrice: 30 }),
      mk({ quantity: 50, avgPrice: 160 }),
    ])).toBe(100 * 30 + 50 * 160);
  });

  it('returns 0 for empty input', () => {
    expect(computeTotalCost([])).toBe(0);
  });
});
