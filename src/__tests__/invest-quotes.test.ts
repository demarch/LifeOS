import { describe, it, expect } from 'vitest';
import { selectTickersToFetch } from '@/lib/invest/quotes';

interface PosRow {
  ticker: string;
  assetClass: 'stock' | 'fii' | 'fixed_income';
}

const p = (over: Partial<PosRow>): PosRow => ({ ticker: 'PETR4', assetClass: 'stock', ...over });

describe('selectTickersToFetch', () => {
  it('returns unique stock/FII tickers and skips fixed_income', () => {
    const tickers = selectTickersToFetch([
      p({ ticker: 'PETR4', assetClass: 'stock' }),
      p({ ticker: 'PETR4', assetClass: 'stock' }),
      p({ ticker: 'HGLG11', assetClass: 'fii' }),
      p({ ticker: 'CDB X', assetClass: 'fixed_income' }),
    ]);
    expect(tickers.sort()).toEqual(['HGLG11', 'PETR4']);
  });

  it('skips empty or whitespace-only tickers', () => {
    expect(selectTickersToFetch([
      p({ ticker: '', assetClass: 'stock' }),
      p({ ticker: '   ', assetClass: 'stock' }),
      p({ ticker: 'VALE3', assetClass: 'stock' }),
    ])).toEqual(['VALE3']);
  });
});
