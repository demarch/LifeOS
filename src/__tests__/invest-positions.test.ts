import { describe, it, expect } from 'vitest';
import { classifyAsset, computePositionValue, computeGainLoss } from '@/lib/invest/positions';

describe('classifyAsset', () => {
  it('returns "stock" for a 4-letter + 1-2 digit B3 code that is not a FII', () => {
    expect(classifyAsset({ code: 'PETR4', type: 'EQUITY', subtype: null, name: 'Petrobras PN' })).toBe('stock');
    expect(classifyAsset({ code: 'VALE3', type: 'EQUITY', subtype: null, name: 'Vale ON' })).toBe('stock');
  });

  it('returns "fii" for a code ending in 11', () => {
    expect(classifyAsset({ code: 'HGLG11', type: 'EQUITY', subtype: 'FII', name: 'HGLG' })).toBe('fii');
    expect(classifyAsset({ code: 'MXRF11', type: 'EQUITY', subtype: null, name: 'MXRF' })).toBe('fii');
  });

  it('returns "fixed_income" when type is FIXED_INCOME', () => {
    expect(classifyAsset({ code: null, type: 'FIXED_INCOME', subtype: 'CDB', name: 'CDB 100% CDI' })).toBe('fixed_income');
  });

  it('returns "fixed_income" for known fixed-income subtypes regardless of type', () => {
    for (const subtype of ['CDB', 'LCI', 'LCA', 'TESOURO', 'LC']) {
      expect(classifyAsset({ code: null, type: 'OTHER', subtype, name: subtype })).toBe('fixed_income');
    }
  });

  it('falls back to "fixed_income" when the code is malformed', () => {
    expect(classifyAsset({ code: 'XYZ', type: 'OTHER', subtype: null, name: 'unknown' })).toBe('fixed_income');
    expect(classifyAsset({ code: null, type: 'OTHER', subtype: null, name: 'unknown' })).toBe('fixed_income');
  });
});

describe('computePositionValue', () => {
  it('stock: quantity times latest quote', () => {
    expect(computePositionValue({ assetClass: 'stock', quantity: 100, lastQuote: 38.40, pluggyBalance: null })).toBe(3840);
  });

  it('fii: quantity times latest quote', () => {
    expect(computePositionValue({ assetClass: 'fii', quantity: 50, lastQuote: 172.30, pluggyBalance: null })).toBe(50 * 172.30);
  });

  it('fixed_income: uses pluggyBalance directly, ignores quote', () => {
    expect(computePositionValue({ assetClass: 'fixed_income', quantity: 1, lastQuote: 999, pluggyBalance: 12345.67 })).toBe(12345.67);
  });

  it('stock without quote: returns 0 (caller must supply previous lastQuote)', () => {
    expect(computePositionValue({ assetClass: 'stock', quantity: 100, lastQuote: null, pluggyBalance: null })).toBe(0);
  });
});

describe('computeGainLoss', () => {
  it('positive when currentValue exceeds invested cost', () => {
    expect(computeGainLoss({ currentValue: 4000, quantity: 100, avgPrice: 30 })).toBe(1000);
  });

  it('negative when currentValue is below invested cost', () => {
    expect(computeGainLoss({ currentValue: 2500, quantity: 100, avgPrice: 30 })).toBe(-500);
  });

  it('zero when currentValue matches cost', () => {
    expect(computeGainLoss({ currentValue: 3000, quantity: 100, avgPrice: 30 })).toBe(0);
  });
});
