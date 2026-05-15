import { describe, it, expect } from 'vitest';
import { mapInvestmentToPosition } from '@/lib/invest/pluggy-invest';
import stocks from '@/lib/invest/__fixtures__/pluggy-invest-stocks.json';
import fixed from '@/lib/invest/__fixtures__/pluggy-invest-fixed.json';

describe('mapInvestmentToPosition', () => {
  it('maps a stock investment to a "stock" position with ticker', () => {
    const pos = mapInvestmentToPosition(stocks[0]);
    expect(pos.assetClass).toBe('stock');
    expect(pos.ticker).toBe('PETR4');
    expect(pos.quantity).toBe(100);
    expect(pos.avgPrice).toBe(30);
    expect(pos.currentValue).toBe(3840);
    expect(pos.pluggyId).toBe('pluggy-pos-1');
    expect(pos.name).toBe('Petrobras PN');
  });

  it('maps an FII (subtype FII or code suffix 11) to "fii"', () => {
    const pos = mapInvestmentToPosition(stocks[1]);
    expect(pos.assetClass).toBe('fii');
    expect(pos.ticker).toBe('HGLG11');
  });

  it('maps a CDB to "fixed_income" with name as ticker and currentValue = balance', () => {
    const pos = mapInvestmentToPosition(fixed[0]);
    expect(pos.assetClass).toBe('fixed_income');
    expect(pos.ticker).toBe('CDB 100% CDI');
    expect(pos.currentValue).toBe(11250.55);
    expect(pos.lastQuote).toBeNull();
  });

  it('maps a Tesouro to "fixed_income"', () => {
    const pos = mapInvestmentToPosition(fixed[1]);
    expect(pos.assetClass).toBe('fixed_income');
    expect(pos.ticker).toBe('Tesouro IPCA+ 2035');
    expect(pos.currentValue).toBe(5310.10);
  });

  it('computes avgPrice as amount / quantity (or 0 if quantity is 0)', () => {
    expect(mapInvestmentToPosition({ ...stocks[0], quantity: 0 } as typeof stocks[0]).avgPrice).toBe(0);
  });
});
